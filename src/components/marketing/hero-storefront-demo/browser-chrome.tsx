type BrowserChromeProps = {
  url: string;
  children: React.ReactNode;
};

/** Стилизиран browser прозорец: адресна лента + traffic-light точки. */
export function BrowserChrome({ url, children }: BrowserChromeProps) {
  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-surface-0 shadow-float">
      <div className="flex items-center gap-2 border-b border-surface-200 bg-surface-100 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-surface-300" />
          <span className="size-2.5 rounded-full bg-surface-300" />
          <span className="size-2.5 rounded-full bg-surface-300" />
        </span>
        <span className="ml-2 flex-1 truncate rounded-full bg-surface-0 px-3 py-1 text-center text-xs text-ink-500">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}
