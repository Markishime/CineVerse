import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
  tone = "default",
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "default" | "primary" | "gold" | "cyan" | "accent" | "muted";
}) {
  const tones = {
    default: "bg-white/12 text-white",
    primary: "bg-[var(--primary)] text-white",
    // Solid gold + dark text so labels stay readable on any card
    gold: "bg-[var(--gold)] !text-black font-bold",
    cyan: "bg-[var(--secondary)] text-[#041218] font-semibold",
    accent: "bg-[var(--accent)] text-white font-semibold",
    muted: "bg-black/55 text-white",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
