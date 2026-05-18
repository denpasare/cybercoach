export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-12 border-b border-slate-200 bg-white" />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
        <aside className="space-y-2 border-r border-slate-200 bg-white p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-md bg-slate-50 p-3">
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </aside>
        <section className="flex items-center justify-center text-sm text-slate-500">
          Loading inbox…
        </section>
      </div>
    </div>
  );
}
