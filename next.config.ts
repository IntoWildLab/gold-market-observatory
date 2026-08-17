import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 明确项目根目录, 避免被工作区其它 lockfile 干扰
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
