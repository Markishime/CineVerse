"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Free legal download control.
 * Only render when `downloadUrl` comes from a rights-approved source
 * (public domain / creative commons / owned file with downloadAllowed).
 * Never wires to embed-provider streams.
 */
export function DownloadButton({
  downloadUrl,
  downloadLabel,
  className,
  size = "sm",
}: {
  downloadUrl?: string | null;
  downloadLabel?: string | null;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}) {
  if (!downloadUrl) return null;

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      download
      className={cn("inline-flex", className)}
      title={downloadLabel ?? "Download free (no ads)"}
    >
      <Button type="button" variant="gold" size={size} className="!text-black">
        <Download className="h-4 w-4" aria-hidden />
        Download free
      </Button>
    </a>
  );
}
