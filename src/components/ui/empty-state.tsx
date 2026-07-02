import { type ReactNode } from "react";
import { Card } from "./card";

export interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <span aria-hidden className="text-4xl">
        {icon}
      </span>
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      {description && <p className="max-w-md text-sm text-ink-700">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </Card>
  );
}
