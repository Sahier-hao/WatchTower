import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ArrowRight } from "lucide-react";
import { createWorkspace } from "../api/client";

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [webhook, setWebhook] = useState("");
  const [loading, setLoading] = useState(false);
  const [joinId, setJoinId] = useState("");

  const handleCreate = async () => {
    setLoading(true);
    try {
      const ws = await createWorkspace(undefined, name || undefined, webhook || undefined);
      navigate(`/w/${ws.id}`);
    } catch {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    const id = joinId.trim();
    if (id) navigate(`/w/${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">通知助手</h1>
          <p className="text-slate-500 mt-1 text-sm">网站更新监控 · 飞书即时推送</p>
        </div>

        {/* 创建工作空间 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">创建新空间</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="空间名称（可选）"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <input
            type="text"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="飞书 Webhook URL（可选）"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? "创建中..." : "创建并开始"} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 加入已有空间 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">加入已有空间</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="粘贴空间 ID"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <button
              onClick={handleJoin}
              disabled={!joinId.trim()}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              加入
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          把你的空间 ID 分享给他人，就能一起管理同一个通知列表
        </p>
      </div>
    </div>
  );
}
