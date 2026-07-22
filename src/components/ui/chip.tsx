import { cn } from "@/lib/utils";

/** Filter / tab chip with consistent product states */
export function Chip({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        active
          ? "bg-[var(--primary)] text-white"
          : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white",
        className,
      )}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}
