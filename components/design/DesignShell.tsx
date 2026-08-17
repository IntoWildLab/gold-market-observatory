"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * 设计探索公共壳: 跨方案导航 + 桌面/手机预览切换。
 * 仅用于设计预览, 不改变正式页面与任何业务逻辑。
 */

interface Props {
  variant: "v1" | "v2" | "v3";
  name: string;
  tagline: string;
  children: React.ReactNode;
}

const VARIANTS = [
  { id: "v1", label: "A · Terminal Pro", desc: "专业金融终端", href: "/design-v1" },
  { id: "v2", label: "B · Minimal Gold", desc: "极简高端", href: "/design-v2" },
];

export default function DesignShell({ variant, name, tagline, children }: Props) {
  const [view, setView] = useState<"desktop" | "phone">("desktop");

  return (
    <div className="min-h-screen">
      {/* 顶部说明条(所有方案共用, 中性) */}
      <div className="border-b border-black/10 bg-white/80 px-4 py-2 text-center text-xs text-neutral-600 backdrop-blur">
        🎨 设计探索预览 —— 仅供视觉评审, 不影响正式页 (<Link className="underline" href="/">返回正式站 /</Link>)。数据为当前项目真实数据。
      </div>

      {/* 方案切换导航 */}
      <nav className="sticky top-0 z-40 border-b border-black/10 bg-black/5 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2.5">
          {VARIANTS.map((v) => (
            <Link
              key={v.id}
              href={v.href}
              className={`rounded-full px-3 py-1 text-xs transition ${
                v.id === variant ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-black/10"
              }`}
            >
              {v.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">预览</span>
            <button
              type="button"
              onClick={() => setView("desktop")}
              className={`rounded border px-2.5 py-1 text-[11px] ${view === "desktop" ? "border-neutral-900 bg-neutral-900 text-white" : "border-black/20 text-neutral-600"}`}
            >
              桌面端
            </button>
            <button
              type="button"
              onClick={() => setView("phone")}
              className={`rounded border px-2.5 py-1 text-[11px] ${view === "phone" ? "border-neutral-900 bg-neutral-900 text-white" : "border-black/20 text-neutral-600"}`}
            >
              📱 手机端
            </button>
          </div>
        </div>
      </nav>

      {/* 方案标题条 */}
      <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">Design Concept · {variant}</div>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{name}</h1>
        <p className="mt-1 text-sm text-neutral-500">{tagline}</p>
      </div>

      {/* 内容: 桌面全宽 / 手机放进手机框 */}
      {view === "desktop" ? (
        <div className="mx-auto max-w-[1400px] px-4 pb-16">{children}</div>
      ) : (
        <div className="flex justify-center px-2 pb-16">
          <PhoneFrame>{children}</PhoneFrame>
        </div>
      )}
    </div>
  );
}

/** 手机预览框: 固定 390px 宽度, 内容靠响应式布局自然重排 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 w-[390px] overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-white shadow-2xl">
      {/* 状态栏 */}
      <div className="flex items-center justify-between bg-neutral-900 px-6 pb-1 pt-2 text-[10px] text-white/70">
        <span>09:41</span>
        <span className="h-4 w-24 rounded-full bg-neutral-800" />
        <span>📶 🔋</span>
      </div>
      <div className="max-h-[760px] overflow-y-auto">{children}</div>
    </div>
  );
}
