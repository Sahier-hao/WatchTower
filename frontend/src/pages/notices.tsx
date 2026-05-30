import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink, Search, Calendar, Building2 } from "lucide-react";
import { fetchNotices, fetchSources } from "../api/client";
import { ListSkeleton } from "../components/skeleton";
import { openLink } from "../lib/utils";
import type { Notice, Source } from "../types";

const PAGE_SIZE = 30;

// 给每个来源分配颜色
const badgeColors = [
  "bg-blue-50 text-blue-700",
  "bg-green-50 text-green-700",
  "bg-purple-50 text-purple-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
  "bg-indigo-50 text-indigo-700",
  "bg-teal-50 text-teal-700",
  "bg-pink-50 text-pink-700",
  "bg-orange-50 text-orange-700",
  "bg-lime-50 text-lime-700",
  "bg-violet-50 text-violet-700",
  "bg-fuchsia-50 text-fuchsia-700",
  "bg-emerald-50 text-emerald-700",
  "bg-sky-50 text-sky-700",
];

function getBadgeColor(sourceName: string): string {
  let hash = 0;
  for (let i = 0; i < sourceName.length; i++) hash = (hash * 31 + sourceName.charCodeAt(i)) | 0;
  return badgeColors[Math.abs(hash) % badgeColors.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

export default function Notices() {
  const { wsId } = useParams<{ wsId: string }>();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async (append = false) => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [nd, sr] = await Promise.all([
        fetchNotices(wsId, append ? notices.length : 0, PAGE_SIZE, sourceFilter || undefined),
        fetchSources(wsId, 0, 50),
      ]);
      if (append) {
        setNotices(prev => [...prev, ...nd.items]);
      } else {
        setNotices(nd.items);
      }
      setTotal(nd.total);
      setSources(sr.items);
    } finally { setLoading(false); }
  }, [wsId, sourceFilter]);

  useEffect(() => { load(false); }, [load]);

  // 客户端搜索过滤
  const filtered = search.trim()
    ? notices.filter(n => n.title.includes(search.trim()) || n.source_name.includes(search.trim()))
    : notices;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-slate-800">通知列表</h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索标题或来源..."
              className="w-full sm:w-48 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setSearch(""); }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">全部来源</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {loading && notices.length === 0 ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search ? "没有匹配的通知" : "暂无通知"}</p>
        </div>
      ) : (
        <>
          <div className="text-xs text-slate-400 mb-3">
            共 {search ? `匹配 ${filtered.length} / ` : ""}{total} 条通知
          </div>
          <div className="space-y-2">
            {filtered.map(n => {
              const badge = getBadgeColor(n.source_name);
              const displayTime = n.published_at || n.first_seen_at;
              const displayDate = new Date(displayTime).toLocaleDateString("zh-CN");
              return (
                <a
                  key={n.id}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:shadow-sm active:bg-slate-50 transition-all group cursor-pointer"
                  onClick={(e) => openLink(n.url, e)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors leading-relaxed line-clamp-2">
                        {n.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${badge}`}>
                          <Building2 className="w-3 h-3 opacity-60" />
                          {n.source_name}
                        </span>
                        <span className="text-xs text-slate-500">{displayDate}</span>
                        <span className="text-xs text-slate-400">{timeAgo(displayTime)}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1" />
                  </div>
                </a>
              );
            })}
          </div>

          {/* 加载更多 */}
          {!search && notices.length < total && (
            <div className="text-center mt-6">
              <button
                onClick={() => load(true)}
                disabled={loading}
                className="px-6 py-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {loading ? "加载中..." : `加载更多（已显示 ${notices.length} / ${total}）`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
