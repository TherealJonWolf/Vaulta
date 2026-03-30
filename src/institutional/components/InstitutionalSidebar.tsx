import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Link2, Activity, BarChart3, Settings, LogOut, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";

const navItems = [
  { path: "/institutional/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/institutional/review-queue", label: "Review Queue", icon: ClipboardCheck },
  { path: "/institutional/intake", label: "Intake", icon: Link2 },
  { path: "/institutional/activity", label: "Activity Log", icon: Activity },
  { path: "/institutional/reporting", label: "Reporting", icon: BarChart3 },
  { path: "/institutional/settings", label: "Settings", icon: Settings },
];

export const InstitutionalSidebar = () => {
  const { pathname } = useLocation();
  const { user, institutionId, institutionName, signOut } = useInstitutionalAuth();
  const [accentColor, setAccentColor] = useState("#0f172a");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!institutionId) return;
    const fetchBranding = async () => {
      const { data } = await (supabase.from as any)("institution_settings")
        .select("accent_color, logo_path, display_name")
        .eq("institution_id", institutionId)
        .maybeSingle();
      if (data) {
        if (data.accent_color) setAccentColor(data.accent_color);
        if (data.display_name) setDisplayName(data.display_name);
        if (data.logo_path) {
          // logo_path is now a full public URL
          setLogoUrl(data.logo_path);
        }
      }
    };
    fetchBranding();
  }, [institutionId]);

  const shownName = displayName || institutionName;

  return (
    <aside className="w-64 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />
          ) : (
            <div className="h-8 w-8 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: accentColor }}>
              {(shownName || "V").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="text-lg font-semibold text-slate-900 tracking-tight block leading-tight">
              {shownName || "Vaulta"}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Institutional</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active ? "text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              style={active ? { backgroundColor: accentColor } : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <p className="text-xs font-medium text-slate-900 truncate">{shownName}</p>
        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 mt-3 w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
