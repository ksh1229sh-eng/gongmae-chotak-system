import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, verifySessionToken, hashIp } from "../lib/session.ts";

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
