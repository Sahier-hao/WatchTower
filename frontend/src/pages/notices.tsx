import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { fetchNotices, fetchSources } from "../api/client";
import type { Notice, Source } from "../types";

export default function Notices() {
  const { wsId } = useParams<{ wsId: string }>();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [nd, sr] = await Promise.all([
        fetchNotices(wsId, 0, 100, sourceFilter || undefined),
        fetchSources(wsId, 0, 50),
      ]);
      setNotices(nd.items);
      setTotal(nd.total);
      setSources(sr.items);
    } finally { setLoading(false); }
  }, [wsId, sourceFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">通知列表</h1>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="">全部来源</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-center text-slate-400 py-12">加载中...</div>
      : notices.length === 0 ? <div className="text-center py-16 text-slate-400"><p>暂无通知</p></div>
      : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-400">共 {total} 条通知</div>
          <div className="divide-y divide-slate-50">
            {notices.map(n => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 group-hover:text-blue-600 transition-colors truncate">{n.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{n.source_name}</span>
                    {n.published_at && <span>{new Date(n.published_at).toLocaleDateString("zh-CN")}</span>}
                    <span>抓取于 {new Date(n.first_seen_at).toLocaleString("zh-CN")}</span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
