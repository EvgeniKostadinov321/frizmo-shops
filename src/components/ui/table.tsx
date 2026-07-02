import { type HTMLAttributes, type ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-surface-200 bg-surface-0">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-surface-200">{children}</tr>
    </thead>
  );
}

export function TH({ children, className = "", ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 text-left font-medium text-ink-500 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TRow({ children, className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-b border-surface-100 transition-colors last:border-0 hover:bg-surface-50 ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TCell({ children, className = "", ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-ink-900 ${className}`} {...props}>
      {children}
    </td>
  );
}
