/**
 * refined-v5 route shell. The cosmic prototype is intentionally isolated from
 * the production page and from the frozen refined-v4 light theme.
 */
export default function RefinedV5Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #060c18 !important; overflow-x: clip; }`}</style>
      {children}
    </>
  );
}
