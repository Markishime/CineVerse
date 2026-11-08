export default function Loading() {
  return (
    <div
      className="mx-auto min-h-[70vh] w-full max-w-7xl animate-pulse px-4 pb-24 pt-24 sm:px-6"
      role="status"
      aria-label="Loading page"
    >
      <div className="h-8 w-48 rounded-lg bg-white/10" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            className="aspect-[2/3] rounded-lg bg-white/[0.07] ring-1 ring-white/10"
          />
        ))}
      </div>
      <span className="sr-only">Loading CineVerse…</span>
    </div>
  );
}
