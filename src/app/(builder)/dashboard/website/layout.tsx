/**
 * Full-screen черупка за редактора на уебсайта — БЕЗ dashboard header/sidebar.
 * Собствена route група `(builder)`, за да не наследи dashboard chrome-а; URL-ът
 * остава /dashboard/website (route групите не влияят на пътя). Guard-ът е в
 * page.tsx чрез requireShop() — layout-ът е чисто presentational.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden bg-surface-50">{children}</div>;
}
