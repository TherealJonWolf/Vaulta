import { useState, useEffect } from "react";
import { Bell, X, Check, CheckCheck, AlertTriangle, Info, Shield, FileText, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  fraud_alert: { icon: <AlertTriangle size={16} />, color: "text-[#E24B4A]" },
  security: { icon: <Shield size={16} />, color: "text-[#E24B4A]" },
  warning: { icon: <AlertTriangle size={16} />, color: "text-yellow-500" },
  document: { icon: <FileText size={16} />, color: "text-primary" },
  info: { icon: <Info size={16} />, color: "text-primary" },
  success: { icon: <Check size={16} />, color: "text-[#1D9E75]" },
};

const NotificationCenter = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as unknown as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as unknown as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true } as never).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true } as never).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const config = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="text-muted-foreground relative"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E24B4A] text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 z-50 w-[380px] max-h-[480px] cyber-border rounded-xl bg-card shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs font-mono text-muted-foreground">
                      <CheckCheck size={14} className="mr-1" />
                      Read all
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-7 w-7 p-0">
                    <X size={14} />
                  </Button>
                </div>
              </div>

              {/* List */}
              <ScrollArea className="max-h-[400px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground font-rajdhani">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-muted/30 transition-colors ${
                          !n.read ? "bg-primary/[0.03]" : ""
                        }`}
                        onClick={() => !n.read && markAsRead(n.id)}
                      >
                        <div className={`mt-0.5 shrink-0 ${config(n.type).color}`}>
                          {config(n.type).icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-rajdhani font-semibold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                              {n.title}
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                              className="shrink-0 text-muted-foreground/50 hover:text-[#E24B4A] transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono leading-relaxed mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
