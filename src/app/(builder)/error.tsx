"use client";

import { ErrorState } from "@/components/error-state";

export default function BuilderError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} scope="builder" homeHref="/dashboard" homeLabel="Към таблото" />;
}
