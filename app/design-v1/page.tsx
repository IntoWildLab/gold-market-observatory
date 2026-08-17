import { buildPageData } from "@/lib/page-data";
import { buildDesignData } from "@/lib/design-data";
import TerminalProPreview from "@/components/design/TerminalProPreview";

export const dynamic = "force-dynamic";

export default async function DesignV1Page() {
  const d = await buildDesignData(await buildPageData());
  return <TerminalProPreview data={d} />;
}
