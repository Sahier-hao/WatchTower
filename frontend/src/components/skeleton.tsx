/** 骨架屏组件 — 加载时显示占位块替代空白 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-slate-200" />
        <div className="h-4 w-16 bg-slate-200 rounded" />
      </div>
      <div className="h-8 w-16 bg-slate-200 rounded mb-1" />
      <div className="h-3 w-24 bg-slate-100 rounded" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-slate-50">
          <div className="h-4 flex-1 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-3 w-12 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 animate-pulse">
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50">
          <div className="h-4 flex-1 bg-slate-100 rounded" />
          <div className="h-3 w-16 bg-slate-100 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}
