/** Skeleton shown during page-level React.Suspense / route transition. */
export default function Loading() {
  return (
    <div className="relative min-h-screen bg-canvas pt-28 md:pt-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {/* Hero skeleton */}
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <div className="h-7 w-64 animate-pulse rounded-full bg-surface-3" />
            <div className="space-y-3">
              <div className="h-14 w-4/5 animate-pulse rounded-lg bg-surface-3" />
              <div className="h-14 w-3/5 animate-pulse rounded-lg bg-surface-3" />
            </div>
            <div className="h-5 w-full max-w-md animate-pulse rounded-md bg-surface-2" />
            <div className="h-5 w-3/4 max-w-md animate-pulse rounded-md bg-surface-2" />
            {/* Track form skeleton */}
            <div className="mt-2 h-28 w-full max-w-xl animate-pulse rounded-xl bg-surface-3" />
            {/* Buttons */}
            <div className="flex gap-3">
              <div className="h-12 w-40 animate-pulse rounded-lg bg-surface-3" />
              <div className="h-12 w-36 animate-pulse rounded-lg bg-surface-2" />
            </div>
          </div>
          {/* Console card skeleton */}
          <div className="hidden lg:block">
            <div className="h-80 w-full animate-pulse rounded-2xl bg-surface-2" />
          </div>
        </div>

        {/* Section skeletons */}
        <div className="mt-32 space-y-6">
          <div className="h-7 w-32 animate-pulse rounded-full bg-surface-3" />
          <div className="h-12 w-2/3 animate-pulse rounded-lg bg-surface-3" />
          <div className="h-5 w-1/2 animate-pulse rounded-md bg-surface-2" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
