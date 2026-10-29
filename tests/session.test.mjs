import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, createSessionToken, hashIp, normalizeIp, verifySessionToken } from "../lib/session.ts";

const SECRET = "a".repeat(40);
const restore = (key, value) => (value === undefined ? delete process.env[key] : (process.env[key] = value));

// 환경 변수를 잠깐 바꿔 실행하고 원래대로 돌려놓습니다.
const withEnv = (env, fn) => {
  const old = { STAFF_PASSWORD: process.env.STAFF_PASSWORD, SESSION_SECRET: process.env.SESSION_SECRET };
  for (const [k, v] of Object.entries(env)) restore(k, v);
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(old)) restore(k, v);
  }
};

test("서명한 쿠키는 통과하고, 12시간이 지나면 만료", () => {
  withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: SECRET }, () => {
    const now = 1_800_000_000_000;
    const token = createSessionToken(now);
    assert.equal(verifySessionToken(token, now + 1000), true);
    assert.equal(verifySessionToken(token, now + 12 * 3600 * 1000 + 1000), false);
  });
});

test("고쳐 쓴 쿠키·빈 쿠키·엉뚱한 모양은 거절", () => {
  withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: SECRET }, () => {
    const [exp, sig] = createSessionToken().split(".");
    assert.equal(verifySessionToken(`${Number(exp) + 99999}.${sig}`), false); // 만료 시각만 늘림
    assert.equal(verifySessionToken(`${exp}.${sig}x`), false);
    assert.equal(verifySessionToken(undefined), false);
    assert.equal(verifySessionToken("abc"), false);
    assert.equal(verifySessionToken("abc.def"), false);
  });
});

test("서명 열쇠는 비밀번호와 별개: 비밀번호만 바꿔도 쿠키는 유효, 열쇠를 바꾸면 무효", () => {
  const token = withEnv({ STAFF_PASSWORD: "pw1", SESSION_SECRET: SECRET }, () => createSessionToken());
  assert.equal(withEnv({ STAFF_PASSWORD: "pw2", SESSION_SECRET: SECRET }, () => verifySessionToken(token)), true);
  assert.equal(withEnv({ STAFF_PASSWORD: "pw1", SESSION_SECRET: "b".repeat(40) }, () => verifySessionToken(token)), false);
});

test("SESSION_SECRET이 없거나 32자보다 짧으면 아무도 로그인 못 하고 쿠키도 만들 수 없음", () => {
  const token = withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: SECRET }, () => createSessionToken());
  assert.equal(withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: undefined }, () => verifySessionToken(token)), false);
  assert.equal(withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: "short" }, () => verifySessionToken(token)), false);
  assert.throws(() => withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: "short" }, () => createSessionToken()));
});

test("접속지 요약값은 같은 입력이면 같고, 원문 IP는 들어 있지 않음", () => {
  withEnv({ STAFF_PASSWORD: "pw", SESSION_SECRET: SECRET }, () => {
    assert.equal(hashIp("1.2.3.4"), hashIp("1.2.3.4"));
    assert.notEqual(hashIp("1.2.3.4"), hashIp("1.2.3.5"));
    assert.ok(!hashIp("1.2.3.4").includes("1.2.3.4"));
  });
});

test("IPv6는 /64 대역(앞 4묶음)을 한 접속지로 묶음: 주소를 바꿔도 같은 값", () => {
  const same = ["2001:db8:1:2::1", "2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd", "2001:DB8:1:2:ffff::", "[2001:db8:1:2::9]", "2001:db8:1:2::9%en0"];
  for (const ip of same) assert.equal(normalizeIp(ip), "2001:0db8:0001:0002::/64", ip);
  assert.notEqual(normalizeIp("2001:db8:1:3::1"), normalizeIp("2001:db8:1:2::1")); // 대역이 다르면 다른 접속지
});

test("IPv4·IPv4 매핑·알 수 없는 모양은 그대로(또는 IPv4로)", () => {
  assert.equal(normalizeIp("203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp("unknown"), "unknown");
  assert.equal(normalizeIp("1::2::3"), "1::2::3"); // :: 가 두 번이면 잘못된 주소라 그대로
  assert.equal(normalizeIp("::1"), "0000:0000:0000:0000::/64");
});

test("clientIp는 x-forwarded-for 첫 값을 쓰고 IPv6는 /64로 묶음", () => {
  const req = (h) => new Request("http://x/", { headers: h });
  assert.equal(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(req({ "x-forwarded-for": "2001:db8:1:2::5" })), "2001:0db8:0001:0002::/64");
  assert.equal(clientIp(req({ "x-real-ip": "198.51.100.1" })), "198.51.100.1");
  assert.equal(clientIp(req({})), "unknown");
});
