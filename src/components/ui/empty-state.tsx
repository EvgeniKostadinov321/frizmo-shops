import { type ReactNode } from "react";
import { Card } from "./card";
import { Icon, type IconName } from "./icon";

export interface EmptyStateProps {
  /** Име на икона от вътрешния SVG set (без емоджита в платформения UI). */
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-100 text-ink-500">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      {description && <p className="max-w-md text-sm text-ink-700">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
