/**
 * Route-scoped shell for the dark v5 research desk. Keeping the document
 * styles here lets the preview and a future root integration share the exact
 * same shell without changing the global layout or the frozen v4 route.
 */
export default function V5PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #060c18 !important; overflow-x: clip; }`}</style>
      {children}
    </>
  );
}
