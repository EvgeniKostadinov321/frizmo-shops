"use client";

import { ErrorState } from "@/components/error-state";

export default function MarketingError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} scope="marketing" />;
}
