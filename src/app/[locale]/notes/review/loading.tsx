export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10" role="status" aria-live="polite">
      <span className="sr-only">Loading review</span>
      <div className="skeleton h-5 w-24" />
      <div className="skeleton mt-4 h-8 w-40" />
      <div className="skeleton mt-6 h-72 rounded-3xl" />
    </div>
  );
}
