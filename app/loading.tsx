export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="chupa-card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-3 w-20" />
            </div>
          </div>
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
          <div className="skeleton h-40 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
