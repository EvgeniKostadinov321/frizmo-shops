"use client";

import { Button } from "@/components/ui";

/** Печата текущата страница (складовата бележка). */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      Печат
    </Button>
  );
}
