"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Показва еднократен toast след успешно изтриване на акаунт (redirect към „/?deleted=1"). */
export function DeletedAccountToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deleted") === "1") {
      toast.success("Акаунтът е изтрит.");
      window.history.replaceState(null, "", "/");
    }
  }, []);
  return null;
}
