import { econt } from "./econt";
import { speedy } from "./speedy";
import type { CourierId, CourierProvider } from "./types";

const REGISTRY: Record<CourierId, CourierProvider> = { econt, speedy };

export function getCourier(id: CourierId): CourierProvider {
  return REGISTRY[id];
}

export * from "./types";
