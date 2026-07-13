import { epay } from "./epay";
import type { PaymentId, PaymentProvider } from "./types";

const REGISTRY: Record<PaymentId, PaymentProvider> = { epay };

export function getPaymentProvider(id: PaymentId): PaymentProvider {
  return REGISTRY[id];
}

export * from "./types";
