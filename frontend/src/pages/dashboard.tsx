import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Radio, Bell, CheckCircle, AlertTriangle, Activity, Info } from "lucide-react";
import { fetchStats, fetchNotices } from "../api/client";
import axios from "axios";
import { CardSkeleton } from "../components/skeleton";
import type { Stats, Notice } from "../types";

const baseURL = import.meta.env.VITE_API_BASE || "/api";

export default function Dashboard() {
  const { wsId } = useParams<{ wsId: string }>();
  const [stats, setStats] = useState<Stats | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    Promise.all([
      fetchStats(wsId),
      fetchNotices(wsId, 0, 6),
      axios.get(`${baseURL}/${wsId}/runs`, { params: { limit: 3 } }).then(r => r.data.items || []).catch(() => []),
    ]).then(([s, n, r]) => {
      setStats(s);
      setNotices(n.items);
      setRuns(r);
      setLoading(false);
    });
  }, [wsId]);

  if (loading) return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-slate-800 mb-6">仪表盘</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-6">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    </div>
  );

  if (!stats) return null;

  const cards = [
    { label: "爬取源总数", value: stats.source_count, sub: `${stats.active_source_count} 个启用`, icon: Radio, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "累计通知", value: stats.notice_total, sub: `今日新增 ${stats.today_new} 条`, icon: Bell, color: "text-green-600", bg: "bg-green-50" },
    { label: "推送成功率", value: `${stats.push_success_rate}%`, sub: "GitHub Actions 自动运行", icon: CheckCircle, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-slate-800 mb-6">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-slate-500">{card.label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{card.value}</div>
            <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 最近通知 - 占3列 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-medium text-slate-700">最近通知</span>
              <a href={`/w/${wsId}/notices`} className="text-xs text-blue-600 hover:text-blue-700">查看全部 →</a>
            </div>
            {notices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无通知</p>
                <p className="text-xs mt-1">添加爬取源后，新通知会显示在这里</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notices.map((n) => (
                  <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 truncate group-hover:text-blue-600">{n.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px]">{n.source_name}</span>
                        {n.published_at && <span>{new Date(n.published_at).toLocaleDateString("zh-CN")}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 ml-2 shrink-0">{timeAgo((n.published_at || n.first_seen_at))}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧栏 - 占2列 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 最近爬取 */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700 text-sm">最近爬取</span>
            </div>
            {runs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">暂无记录，等待首次 GitHub Actions 运行</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {runs.map((r: any) => (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">
                        {r.status === "ok" ? "✅ 运行成功" : "❌ 失败"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {r.finished_at ? timeAgo(r.finished_at + "Z") : "-"}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-slate-400">
                      <span>{r.source_count} 源</span>
                      <span>+{r.new_count} 新</span>
                      <span>{r.notified_count} 推送</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 使用说明 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-blue-700 text-sm">快速上手</span>
            </div>
            <div className="space-y-2 text-xs text-blue-600/80">
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">1</span>
                <span>去<b>设置</b>页面添加你的飞书 Webhook 接收通知</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">2</span>
                <span>去<b>爬取源</b>页面添加你想监控的网页</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">3</span>
                <span>点<b>测试</b>验证选择器，点<b>▶</b>手动爬取</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold mt-0.5">4</span>
                <span>GitHub Actions 每<b>1 小时</b>自动爬取（6:00-23:00）</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr.replace(" ", "T") + "Z");
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
