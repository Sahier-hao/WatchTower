import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Save, Plus, Trash2 } from "lucide-react";
import { fetchSettings, updateSettings, fetchMyWebhooks, addMyWebhook, deleteMyWebhook } from "../api/client";
import { useToast } from "../components/toast";
import type { Settings } from "../types";

function getToken(): string {
  const key = "wt_user_token";
  let t = localStorage.getItem(key);
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(key, t); }
  return t;
}

export default function SettingsPage() {
  const { wsId } = useParams<{ wsId: string }>();
  const [settings, setSettings] = useState<Settings>({ default_crawl_interval: 30 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hooks, setHooks] = useState<any[]>([]);
  const [newHook, setNewHook] = useState("");
  const { toast } = useToast();
  const token = getToken();

  const load = useCallback(async () => {
    if (!wsId) return;
    const [s, h] = await Promise.all([
      fetchSettings(wsId),
      fetchMyWebhooks(wsId, token),
    ]);
    setSettings(s);
    setHooks(h || []);
    setLoading(false);
  }, [wsId, token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!wsId) return;
    setSaving(true);
    try { await updateSettings(wsId, settings); toast("success", "已保存"); }
    catch { toast("error", "保存失败"); }
    finally { setSaving(false); }
  };

  const handleAddHook = async () => {
    if (!wsId || !newHook.trim()) return;
    try {
      await addMyWebhook(wsId, token, newHook.trim());
      setNewHook("");
      await load();
      toast("success", "已添加");
    } catch { toast("error", "添加失败"); }
  };

  const handleDeleteHook = async (id: string) => {
    if (!wsId) return;
    try { await deleteMyWebhook(wsId, token, id); await load(); }
    catch { toast("error", "删除失败"); }
  };

  if (loading) return <div className="text-center text-slate-400 py-12">加载中...</div>;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-slate-800 mb-6">设置</h1>

      {/* 个人 Webhook */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-700 mb-1">我的飞书通知</h2>
        <p className="text-xs text-slate-400 mb-4">
          只有你自己能看到，不会泄露给同空间其他人
        </p>

        {hooks.length === 0 && (
          <p className="text-sm text-slate-400 mb-3">还没添加，加一个飞书 Webhook 开始接收通知</p>
        )}

        <div className="space-y-2 mb-4">
          {hooks.map((h: any) => (
            <div key={h.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-slate-600 truncate">{h.webhook_url}</span>
              <button onClick={() => handleDeleteHook(h.id)} className="text-slate-400 hover:text-red-500 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newHook}
            onChange={e => setNewHook(e.target.value)}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            onKeyDown={e => e.key === "Enter" && handleAddHook()}
          />
          <button onClick={handleAddHook} disabled={!newHook.trim()} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>
      </div>

      {/* 空间名称 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-4">空间设置</h2>

        <div className="mb-4">
          <label className="block text-sm text-slate-600 mb-1">空间名称</label>
          <input
            type="text"
            value={settings.workspace_name || ""}
            onChange={e => setSettings({ ...settings, workspace_name: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />{saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
