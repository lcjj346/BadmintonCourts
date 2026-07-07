"use client";

import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href.split("?")[0]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="mt-2 w-full rounded-lg border border-court py-2 text-sm font-semibold text-court"
    >
      {copied ? "Copied ✓" : "Copy manage link"}
    </button>
  );
}
