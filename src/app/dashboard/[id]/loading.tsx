/** Boundary for the dynamic [id] segment so navigating to a QR code shows a skeleton instantly. */
export default function QrDetailLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading QR code">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
