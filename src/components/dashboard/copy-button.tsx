"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Icon } from "@/components/ui";

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = "Копирай" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Копирано");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Копирането не бе успешно");
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
      <Icon name={copied ? "check" : "link"} size={16} />
      {copied ? "Копирано" : label}
    </Button>
  );
}
