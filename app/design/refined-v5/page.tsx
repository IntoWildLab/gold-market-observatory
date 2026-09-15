import type { Metadata } from "next";
import { buildPageData } from "@/lib/page-data";
import { buildDesignData } from "@/lib/design-data";
import CosmicV5Preview from "@/components/design/refined-v5/CosmicV5Preview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "黄金市场观察站 · Cosmic Prototype",
  description: "Gold Market Observatory refined-v5 dark cosmic design prototype.",
};

export default async function DesignRefinedV5Page() {
  const data = await buildDesignData(await buildPageData());
  return <CosmicV5Preview data={data} />;
}
