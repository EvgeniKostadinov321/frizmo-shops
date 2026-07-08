import Link from "next/link";
import { type HTMLAttributes, type ReactNode } from "react";

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-card border border-surface-200 bg-surface-0 ${className}`}>
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
      className={`relative border-b border-surface-100 transition-colors last:border-0 hover:bg-surface-50 ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

/**
 * Клетка, чието цяло съдържание е линк, разтеглив върху реда — така целият ред
 * е кликаем (истински `<a>`: клавиатура/SR/среден бутон работят). Сложи я като
 * ПЪРВА клетка на реда; редът получава `relative` през TRow. Другите клетки
 * рендерират текста си над линка автоматично (той е с фон-слой, не покрива
 * z-съдържанието на съседните клетки, защото те са в нормалния поток).
 */
export function TCellLink({
  href,
  children,
  label,
  className = "",
}: {
  href: string;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <td className={`relative px-4 py-3 text-ink-900 ${className}`}>
      <Link href={href} className="font-medium after:absolute after:inset-0 after:content-['']">
        {children}
      </Link>
      {label && <span className="sr-only">{label}</span>}
    </td>
  );
}

export function TCell({ children, className = "", ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-ink-900 ${className}`} {...props}>
      {children}
    </td>
  );
}
