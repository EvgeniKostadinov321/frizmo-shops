"use client";

import { ErrorState } from "@/components/error-state";

export default function AuthError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} scope="auth" />;
}
