import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Activity, CheckCircle, AlertCircle } from "lucide-react";
import axios from "axios";

interface CrawlRun {
  id: string;
  source_count: number;
  new_count: number;
  notified_count: number;
  status: string;
  error_msg: string | null;
  started_at: string;
  finished_at: string;
}

const baseURL = import.meta.env.VITE_API_BASE || "/api";

export default function Runs() {
  const { wsId } = useParams<{ wsId: string }>();
  const [runs, setRuns] = useState<CrawlRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    axios.get(`${baseURL}/${wsId}/runs`, { params: { limit: 30 } })
      .then(res => setRuns(res.data.items || []))
      .finally(() => setLoading(false));
  }, [wsId]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-slate-800 mb-2">爬取日志</h1>
      <p className="text-sm text-slate-400 mb-6">GitHub Actions 每次自动爬取的运行记录</p>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-100 rounded mb-2" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>暂无爬取记录</p>
          <p className="text-xs mt-1">首次 GitHub Actions 运行后会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(r => (
            <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {r.status === "ok" ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${r.status === "ok" ? "text-slate-700" : "text-red-600"}`}>
                    {r.status === "ok" ? "运行成功" : "运行失败"}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {r.finished_at ? new Date(r.finished_at).toLocaleString("zh-CN") : "-"}
                </span>
              </div>

              <div className="flex gap-4 text-xs text-slate-500">
                <span>📡 {r.source_count} 个源</span>
                <span>🆕 新增 {r.new_count} 条</span>
                <span>📨 推送 {r.notified_count} 条</span>
              </div>

              {r.error_msg && (
                <div className="mt-2 text-xs text-red-500 bg-red-50 rounded px-2 py-1">
                  {r.error_msg}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
