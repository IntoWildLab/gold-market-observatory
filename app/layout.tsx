import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "黄金市场观察站 · Gold Market Observatory",
  description:
    "轻量级黄金研究 Dashboard: 黄金价格 / 美元指数 / 美国实际利率 / 美债收益率 / 黄金ETF资金流 / 央行购金。真实数据、可解释、可运行。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">{children}</div>
      </body>
    </html>
  );
}
