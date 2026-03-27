import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Link2, Activity, BarChart3, LogOut } from "lucide-react";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";

const navItems = [
  { path: "/institutional/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/institutional/intake", label: "Intake", icon: Link2 },
  { path: "/institutional/activity", label: "Activity Log", icon: Activity },
  { path: "/institutional/reporting", label: "Reporting", icon: BarChart3 },
];

export const InstitutionalSidebar = () => {
  const { pathname } = useLocation();
  const { user, institutionName, signOut } = useInstitutionalAuth();

  return (
    <aside className="w-64 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
      <div className="p-6 border-b border-slate-200">
        <span className="text-lg font-semibold text-slate-900 tracking-tight">Vaulta</span>
        <span className="text-xs text-slate-500 block mt-0.5">Institutional Platform</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <p className="text-xs font-medium text-slate-900 truncate">{institutionName}</p>
        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 mt-3 text-xs text-slate-500 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
};
