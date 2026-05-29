import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Save } from "lucide-react";
import { fetchSettings, updateSettings } from "../api/client";
import { useToast } from "../components/toast";
import type { Settings } from "../types";

export default function SettingsPage() {
  const { wsId } = useParams<{ wsId: string }>();
  const [settings, setSettings] = useState<Settings>({ default_crawl_interval: 30 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!wsId) return;
    fetchSettings(wsId).then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, [wsId]);

  const handleSave = async () => {
    if (!wsId) return;
    setSaving(true);
    try {
      await updateSettings(wsId, settings);
      toast("success", "设置已保存");
    } catch {
      toast("error", "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center text-slate-400 py-12">加载中...</div>;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-slate-800 mb-6">系统设置</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">空间名称</label>
          <input
            type="text"
            value={settings.workspace_name || ""}
            onChange={(e) => setSettings({ ...settings, workspace_name: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            空间默认飞书 Webhook URL
          </label>
          <input
            type="text"
            value={settings.default_webhook || ""}
            onChange={(e) => setSettings({ ...settings, default_webhook: e.target.value })}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            空间内所有源默认使用的通知地址，也可以给每个源单独配置
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
