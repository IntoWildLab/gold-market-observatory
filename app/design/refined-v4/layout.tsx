/**
 * refined-v4 路由级布局: 用 route-scoped 样式把 html/body 背景改为浅暖白。
 * 只在 /design/refined-v4 路由生效(该 <style> 仅存在于本路由 HTML 中),
 * 不修改 globals.css / 根 layout / 正式首页。
 */
export default function RefinedV4Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #f7f4ed !important; overflow-x: clip; }`}</style>
      {children}
    </>
  );
}
