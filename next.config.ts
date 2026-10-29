import type { NextConfig } from "next";

// 모든 응답에 붙이는 기본 보안 헤더입니다.
// CSP는 nonce 방식을 쓰면 모든 화면이 요청마다 새로 그려져야 해서(cacheComponents의 정적 부분을 못 씀) 쓰지 않고,
// Next가 넣는 인라인 스크립트를 위해 'unsafe-inline'을 허용합니다. 대신 이 앱은 dangerouslySetInnerHTML을 쓰지 않고
// 외부 스크립트·이미지·글꼴·접속처를 전혀 쓰지 않아, 자기 출처('self') 밖의 자원은 모두 막습니다.
const isDev = process.env.NODE_ENV !== "production";
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`, // 개발 중에는 React가 eval을 씀
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self'${isDev ? " ws: wss:" : ""}`, // 브라우저가 부르는 곳은 이 앱의 API뿐 (OpenAI·Supabase는 서버에서만 호출)
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'", // 다른 사이트가 이 앱을 iframe에 넣지 못하게 (클릭재킹 방지)
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" }, // frame-ancestors를 모르는 옛 브라우저용
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" }, // https로만 접속 (배포 환경에서 적용)
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
