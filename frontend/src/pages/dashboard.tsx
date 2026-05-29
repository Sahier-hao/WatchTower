import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Radio, Bell, CheckCircle, AlertTriangle } from "lucide-react";
import { fetchStats, fetchNotices } from "../api/client";
import type { Stats, Notice } from "../types";

export default function Dashboard() {
  const { wsId } = useParams<{ wsId: string }>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    Promise.all([fetchStats(wsId), fetchNotices(wsId, 0, 6)]).then(([s, n]) => {
      setStats(s);
      setNotices(n.items);
      setLoading(false);
    });
  }, [wsId]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">加载中...</div>;
  if (!stats) return null;

  const cards = [
    { label: "爬取源总数", value: stats.source_count, sub: `${stats.active_source_count} 个启用`, icon: Radio, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "今日新增", value: stats.today_new, sub: `累计 ${stats.notice_total} 条`, icon: Bell, color: "text-green-600", bg: "bg-green-50" },
    { label: "推送成功率", value: `${stats.push_success_rate}%`, sub: "飞书 Webhook", icon: CheckCircle, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-slate-800 mb-6">
        仪表盘 {stats.workspace_name ? `— ${stats.workspace_name}` : ""}
      </h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-slate-500">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{card.value}</div>
            <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 font-medium text-slate-700">最近通知</div>
        {notices.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            暂无通知，快去添加爬取源吧
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notices.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 truncate">{n.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {n.source_name}{n.published_at && ` · ${new Date(n.published_at).toLocaleDateString("zh-CN")}`}
                  </div>
                </div>
                <span className="text-xs text-slate-400 ml-4 shrink-0">{timeAgo(n.first_seen_at)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
