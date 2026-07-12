"use client";

/** Избор на източник за любимите: логнат купувач → сървър (buyerFavorites); гост → localStorage. */
export function pickFavoriteMode(loggedIn: boolean): "server" | "local" {
  return loggedIn ? "server" : "local";
}
