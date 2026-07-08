"use client";

import { ErrorState } from "@/components/error-state";

export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} scope="dashboard" homeHref="/dashboard" homeLabel="Към таблото" />;
}
