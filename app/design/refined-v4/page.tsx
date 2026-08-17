import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { buildPageData } from "@/lib/page-data";
import { buildDesignData } from "@/lib/design-data";
import RefinedV4Preview from "@/components/design/RefinedV4Preview";

export const dynamic = "force-dynamic";

/**
 * 仅对本预览路由生效的 favicon(浏览器只在该页面 HTML 中注入此 <link>)。
 * 正式首页 / 的 favicon 不受影响(未修改 app/layout 与 app/icon)。
 */
export const metadata: Metadata = {
  icons: {
    icon: "/branding/gold-favicon.png",
  },
};

export default async function DesignRefinedV4Page() {
  // Header 品牌图标: 使用与 Tab favicon 相同的方形黑金图标
  const iconExists = existsSync(path.join(process.cwd(), "public", "branding", "gold-favicon.png"));
  const d = await buildDesignData(await buildPageData());
  return <RefinedV4Preview data={d} iconExists={iconExists} />;
}
