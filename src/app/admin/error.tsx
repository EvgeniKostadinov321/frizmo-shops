"use client";

import { ErrorState } from "@/components/error-state";

export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} scope="admin" homeHref="/admin" homeLabel="Към админ панела" />;
}
