import type { Metadata } from "next";
import { buildPageData } from "@/lib/page-data";
import { buildDesignData } from "@/lib/design-data";
import CosmicV5Preview from "@/components/design/refined-v5/CosmicV5Preview";
import V5PageShell from "@/components/design/refined-v5/V5PageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  icons: { icon: "/branding/gold-favicon.png" },
};

export default async function HomePage() {
  const data = await buildDesignData(await buildPageData());

  return (
    <V5PageShell>
      <CosmicV5Preview data={data} />
    </V5PageShell>
  );
}
