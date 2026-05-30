import { useState } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { Bell, Radio, Settings, LayoutDashboard, LogOut, Share2, Menu, X, Activity } from "lucide-react";

export default function Layout() {
  const { wsId } = useParams<{ wsId: string }>();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { to: `/w/${wsId}`, end: true, icon: LayoutDashboard, label: "仪表盘" },
    { to: `/w/${wsId}/sources`, icon: Radio, label: "爬取源" },
    { to: `/w/${wsId}/notices`, icon: Bell, label: "通知列表" },
    { to: `/w/${wsId}/runs`, icon: Activity, label: "爬取日志" },
    { to: `/w/${wsId}/settings`, icon: Settings, label: "设置" },
  ];

  const handleCopyWsId = () => {
    if (wsId) navigator.clipboard.writeText(wsId);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50">
      {/* 手机顶部栏 */}
      <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-slate-800 text-sm">通知助手</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-slate-500">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* 手机弹出菜单 */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white" onClick={() => setMenuOpen(false)}>
          <div className="flex flex-col h-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100">
              <span className="font-semibold text-slate-800">菜单</span>
              <button onClick={() => setMenuOpen(false)} className="p-2"><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 p-4 space-y-1" onClick={() => setMenuOpen(false)}>
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
                  <item.icon className="w-5 h-5" />{item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-100 space-y-2">
              <button onClick={handleCopyWsId} className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-500 hover:bg-slate-50">📋 复制空间 ID</button>
              <button onClick={() => navigate("/")} className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-500 hover:bg-slate-50">🔄 切换空间</button>
            </div>
          </div>
        </div>
      )}

      {/* 桌面侧边栏 */}
      <aside className="hidden lg:flex w-56 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-slate-100">
          <Bell className="w-5 h-5 text-blue-600 mr-2" />
          <span className="font-semibold text-slate-800">通知助手</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button onClick={handleCopyWsId} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-50">
            <Share2 className="w-3.5 h-3.5" />复制空间 ID 分享
          </button>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-50">
            <LogOut className="w-3.5 h-3.5" />切换空间
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-auto p-3 lg:p-6">
        <Outlet />
      </main>

      {/* 手机底部导航 */}
      <nav className="lg:hidden flex items-center justify-around h-14 bg-white border-t border-slate-200 shrink-0">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] ${isActive ? "text-blue-600" : "text-slate-400"}`}>
            <item.icon className="w-5 h-5" />{item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
