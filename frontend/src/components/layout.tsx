import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { Bell, Radio, Settings, LayoutDashboard, LogOut, Share2 } from "lucide-react";

export default function Layout() {
  const { wsId } = useParams<{ wsId: string }>();
  const navigate = useNavigate();

  const navItems = [
    { to: `/w/${wsId}`, end: true, icon: LayoutDashboard, label: "仪表盘" },
    { to: `/w/${wsId}/sources`, icon: Radio, label: "爬取源" },
    { to: `/w/${wsId}/notices`, icon: Bell, label: "通知列表" },
    { to: `/w/${wsId}/settings`, icon: Settings, label: "设置" },
  ];

  const handleCopyWsId = () => {
    if (wsId) {
      navigator.clipboard.writeText(wsId).then(() => {});
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-slate-100">
          <Bell className="w-5 h-5 text-blue-600 mr-2" />
          <span className="font-semibold text-slate-800">通知助手</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button
            onClick={handleCopyWsId}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            复制空间 ID 分享
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            切换空间
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
