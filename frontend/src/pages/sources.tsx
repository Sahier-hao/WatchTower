import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Play, Eye, Loader2, Radio, ChevronRight } from "lucide-react";
import { fetchSources, createSource, updateSource, deleteSource, testSource, manualCrawl, fetchNotices, fetchStats } from "../api/client";
import type { SourceFormData } from "../api/client";
import { useToast } from "../components/toast";
import { openLink } from "../lib/utils";
import type { Source, TestResult, CrawlResult, Notice } from "../types";

const defaultForm: SourceFormData = {
  name: "", url: "", list_selector: "", title_selector: "", link_selector: "",
  time_selector: "", webhook_url: "", crawl_interval: 30, is_active: true,
};

export default function Sources() {
  const { wsId } = useParams<{ wsId: string }>();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormData>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [crawling, setCrawling] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceNotices, setSourceNotices] = useState<Record<string, Notice[]>>({});
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([
        fetchSources(wsId, 0, 50),
        fetchStats(wsId),
      ]);
      setSources(data.items);
      setIsAdmin(!!(stats as any).is_admin);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ ...defaultForm }); setEditingId(null); setShowForm(true); };
  const openEdit = (s: Source) => {
    setForm({
      name: s.name, url: s.url, list_selector: s.list_selector, title_selector: s.title_selector,
      link_selector: s.link_selector, time_selector: s.time_selector ?? "",
      webhook_url: s.webhook_url ?? "", crawl_interval: s.crawl_interval, is_active: !!s.is_active,
    });
    setEditingId(s.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!wsId) return;
    setSaving(true);
    try {
      if (editingId) { await updateSource(wsId, editingId, form); toast("success", "已更新"); }
      else { await createSource(wsId, form); toast("success", "已创建"); }
      setShowForm(false); await load();
    } catch (e: any) { toast("error", e?.response?.data?.detail ?? "保存失败"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s: Source) => {
    if (!wsId || !confirm(`确定删除「${s.name}」？`)) return;
    try { await deleteSource(wsId, s.id); toast("success", "已删除"); await load(); }
    catch { toast("error", "删除失败"); }
  };

  const handleTest = async (s: Source) => {
    if (!wsId) return;
    setTestingId(s.id); setTestLoading(true); setTestResult(null);
    try { setTestResult(await testSource(wsId, s.id)); }
    catch (e: any) { toast("error", e?.response?.data?.detail ?? "测试失败"); }
    finally { setTestLoading(false); }
  };

  const handleCrawl = async (s: Source) => {
    if (!wsId) return;
    setCrawling(s.id);
    try { const r: CrawlResult = await manualCrawl(wsId, s.id); toast("success", `发现 ${r.new_count} 条新通知，推送了 ${r.notified} 条`); await load(); }
    catch (e: any) { toast("error", e?.response?.data?.detail ?? "爬取失败"); }
    finally { setCrawling(null); }
  };

  const handleToggle = async (s: Source) => {
    if (!wsId) return;
    try { await updateSource(wsId, s.id, { is_active: !s.is_active }); await load(); }
    catch { toast("error", "切换失败"); }
  };

  const handleToggleExpand = async (s: Source) => {
    if (!wsId) return;
    if (expandedId === s.id) { setExpandedId(null); return; }
    setExpandedId(s.id);
    if (!sourceNotices[s.id]) {
      setNoticesLoading(true);
      try { const data = await fetchNotices(wsId, 0, 10, s.id); setSourceNotices(prev => ({ ...prev, [s.id]: data.items })); }
      finally { setNoticesLoading(false); }
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">爬取源管理</h1>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> 添加爬取源
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">加载中...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>暂无爬取源</p>
          <button onClick={openCreate} className="text-blue-600 text-sm mt-2 hover:underline">添加第一个</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-3 py-3 font-medium">名称</th>
              <th className="text-left px-3 py-3 font-medium hidden md:table-cell">URL</th>
              <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">间隔</th>
              <th className="text-left px-3 py-3 font-medium">状态</th>
              <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">上次爬取</th>
              <th className="text-right px-3 py-3 font-medium">操作</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {sources.map(s => (
                <tr key={s.id}>
                  <td colSpan={7} className="p-0">
                    <div onClick={() => handleToggleExpand(s)} className={`flex items-center cursor-pointer transition-colors ${expandedId === s.id ? "bg-blue-50/50" : "hover:bg-slate-50/50"}`}>
                      <span className="w-8 flex justify-center text-slate-400"><ChevronRight className={`w-4 h-4 transition-transform ${expandedId === s.id ? "rotate-90 text-blue-500" : ""}`} /></span>
                      <span className="px-3 py-3 flex-1 min-w-0"><div className="font-medium text-slate-800 text-sm lg:text-base truncate">{s.name}</div><div className="text-xs text-slate-400">{s.notice_count} 条通知</div></span>
                      <span className="px-3 py-3 text-slate-500 max-w-48 truncate flex-1 hidden md:table-cell" title={s.url}>{s.url}</span>
                      <span className="px-3 py-3 text-slate-500 w-20 hidden sm:table-cell">{s.crawl_interval}分钟</span>
                      <span className="px-3 py-3 w-20 shrink-0"><button onClick={e => { e.stopPropagation(); handleToggle(s); }} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-400"}`}>{s.is_active ? "启用" : "停用"}</button></span>
                      <span className="px-3 py-3 text-xs text-slate-400 w-36 hidden lg:table-cell">{s.last_crawled_at ? new Date(s.last_crawled_at).toLocaleDateString("zh-CN") : "从未"}</span>
                      <span className="px-3 py-3"><div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <>
                            <IconBtn onClick={e => { e.stopPropagation(); handleCrawl(s); }} disabled={crawling === s.id} title="手动爬取">{crawling === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</IconBtn>
                            <IconBtn onClick={e => { e.stopPropagation(); handleTest(s); }} disabled={testingId === s.id} title="测试选择器">{testLoading && testingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}</IconBtn>
                            <IconBtn onClick={e => { e.stopPropagation(); openEdit(s); }} title="编辑"><Pencil className="w-4 h-4" /></IconBtn>
                            <IconBtn onClick={e => { e.stopPropagation(); handleDelete(s); }} title="删除" className="hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></IconBtn>
                          </>
                        )}
                        {!isAdmin && <span className="text-xs text-slate-300">只读</span>}
                      </div></span>
                    </div>
                    {expandedId === s.id && (
                      <div className="bg-blue-50/20 border-t border-blue-100 px-3 lg:px-8 py-3">
                        {noticesLoading ? <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />加载中...</div>
                        : sourceNotices[s.id]?.length ? <div className="space-y-1.5">
                          <div className="text-xs text-slate-400 mb-2">最近 {sourceNotices[s.id].length} 条通知：</div>
                          {sourceNotices[s.id].map(n => (
                            <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => openLink(n.url, e)} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm py-2 group hover:bg-white/60 active:bg-white/80 rounded px-2 -mx-2 transition-colors min-h-[44px]">
                              <span className="text-slate-700 group-hover:text-blue-600 truncate max-w-full">{n.title}</span>
                              <span className="text-xs text-slate-400 shrink-0">{n.published_at ? new Date(n.published_at).toLocaleDateString("zh-CN") : ""}</span>
                              <span className="text-xs text-blue-500 group-hover:text-blue-700 hidden sm:inline">查看</span>
                            </a>))}
                        </div> : <div className="text-sm text-slate-400 py-2">暂无通知记录</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 font-medium text-slate-800">{editingId ? "编辑爬取源" : "添加爬取源"}</div>
            <div className="p-6 space-y-4">
              <Field label="名称" value={form.name} onChange={v => setForm({...form, name: v})} />
              <Field label="URL" value={form.url} onChange={v => setForm({...form, url: v})} />
              <Field label="列表选择器" value={form.list_selector} onChange={v => setForm({...form, list_selector: v})} placeholder="ul.news-list > li" />
              <Field label="标题选择器" value={form.title_selector} onChange={v => setForm({...form, title_selector: v})} placeholder="a.title" />
              <Field label="链接选择器" value={form.link_selector} onChange={v => setForm({...form, link_selector: v})} placeholder="a.title" />
              <Field label="时间选择器(可选)" value={form.time_selector ?? ""} onChange={v => setForm({...form, time_selector: v || ""})} placeholder="span.date" />
              <Field label="专属Webhook(可选)" value={form.webhook_url ?? ""} onChange={v => setForm({...form, webhook_url: v || ""})} placeholder="留空则使用空间默认" />
              <div>
                <label className="block text-sm text-slate-600 mb-1">爬取间隔(分钟)</label>
                <input type="number" min={1} max={1440} value={form.crawl_interval} onChange={e => setForm({...form, crawl_interval: +e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />创建后立即启用
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 测试结果弹窗 */}
      {testingId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setTestingId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 font-medium text-slate-800 flex items-center justify-between"><span>爬取测试</span><button onClick={() => setTestingId(null)} className="text-slate-400 hover:text-slate-600">✕</button></div>
            <div className="p-6">
              {testLoading ? <div className="text-center py-8 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />正在请求并解析...</div>
              : testResult ? <>
                <div className={`text-sm mb-4 px-4 py-2 rounded-lg ${testResult.status === "success" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{testResult.message}</div>
                {testResult.items.length > 0 && <div className="text-sm"><div className="text-slate-500 mb-2 font-medium">解析结果预览：</div>
                  <div className="space-y-2 max-h-96 overflow-auto">
                    {testResult.items.map((item, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3"><div className="font-medium text-slate-800 truncate">{item.title}</div><div className="text-xs text-slate-400 mt-1 truncate">{item.url}</div>{item.time && <div className="text-xs text-slate-400 mt-0.5">{item.time}</div>}</div>
                    ))}
                  </div></div>}
              </> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ onClick, disabled, title, className = "", children }: {
  onClick: (e: React.MouseEvent) => void; disabled?: boolean; title?: string; className?: string; children: React.ReactNode;
}) {
  return <button onClick={onClick} disabled={disabled} className={`p-1.5 rounded hover:bg-slate-100 text-slate-500 ${className}`} title={title}>{children}</button>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className="block text-sm text-slate-600 mb-1">{label}</label><input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></div>;
}
