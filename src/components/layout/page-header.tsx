import { cn } from "@/lib/utils";

/** Consistent product-page title block */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
