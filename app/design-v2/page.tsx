import { buildPageData } from "@/lib/page-data";
import { buildDesignData } from "@/lib/design-data";
import MinimalGoldPreview from "@/components/design/MinimalGoldPreview";

export const dynamic = "force-dynamic";

export default async function DesignV2Page() {
  const d = await buildDesignData(await buildPageData());
  return <MinimalGoldPreview data={d} />;
}
