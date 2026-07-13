import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // ホームディレクトリ等の無関係な lockfile をワークスペースルートと
  // 誤認しないよう、Turbopack のルートを本プロジェクトに固定する。
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
