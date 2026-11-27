/** Esqueleto mostrado na hora em que uma navegação começa. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] gap-6 px-3 py-6 sm:px-4 lg:px-6">
      <div className="hidden w-[236px] shrink-0 lg:block">
        <div className="skeleton h-8 w-32" />
        <div className="mt-7 space-y-2.5">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="skeleton h-9 w-full" />
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="skeleton h-11 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="chupa-card space-y-2.5 p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-2.5 w-20" />
              </div>
            </div>
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
