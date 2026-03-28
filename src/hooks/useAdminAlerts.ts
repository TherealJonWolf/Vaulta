import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

const showNotification = (title: string, body: string, tag: string) => {
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      window.location.hash = "";
      window.location.pathname = "/admin/security";
      n.close();
    };
  } catch {
    // Notification API not available in this context
  }
};

/**
 * Hook that monitors critical security events in real-time via Supabase Realtime
 * and fires browser notifications for admins, even when the admin tab isn't open.
 * Mount this once at the app root level.
 */
export const useAdminAlerts = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const permissionGranted = useRef(false);

  // Request permission once when admin detected
  useEffect(() => {
    if (!isAdmin) return;
    requestNotificationPermission().then((granted) => {
      permissionGranted.current = granted;
    });
  }, [isAdmin]);

  // Fire SOC email alert for critical events
  const fireSocAlert = useCallback(async (severity: string, category: string, title: string, detail: string, sourceId?: string) => {
    try {
      await supabase.functions.invoke("soc-alert-email", {
        body: { mode: "immediate", severity, category, title, detail, source_id: sourceId },
      });
    } catch {
      // Silent fail — don't block UI for alert delivery
    }
  }, []);

  // Subscribe to real-time changes on critical tables
  useEffect(() => {
    if (!isAdmin || !user) return;

    const channel = supabase
      .channel("admin-alerts")
      // Account lockouts
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (newRow.account_locked_at && !oldRow.account_locked_at) {
            const title = "Account Locked";
            const detail = `${newRow.email} has been locked after ${newRow.failed_login_attempts} failed attempts`;
            showNotification("🔒 " + title, detail, `locked-${newRow.user_id}`);
            fireSocAlert("critical", "auth", title, detail, newRow.user_id);
          }
        }
      )
      // Security upload failures
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "document_upload_events" },
        (payload) => {
          const row = payload.new as any;
          if (row.event_type === "security_failure") {
            const title = "Security Upload Failure";
            const detail = `File "${row.file_name}" rejected: ${row.failure_reason || "security violation"}`;
            showNotification("⚠️ " + title, detail, `upload-${row.id}`);
            fireSocAlert("high", "upload", title, detail, row.id);
          }
        }
      )
      // Cross-account fraud signals
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cross_account_signals" },
        (payload) => {
          const row = payload.new as any;
          if (row.severity === "high") {
            const title = "High-Severity Fraud Signal";
            const detail = `${row.signal_type}: ${row.account_count} accounts linked (${(row.confidence_score * 100).toFixed(0)}% confidence)`;
            showNotification("🚨 " + title, detail, `signal-${row.id}`);
            fireSocAlert("critical", "fraud", title, detail, row.id);
          }
        }
      )
      // Account flags (suspensions)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "account_flags" },
        (payload) => {
          const row = payload.new as any;
          const title = "Account Flagged";
          const detail = `Account flagged (${row.flag_type}): ${row.reason}`;
          showNotification("🛑 " + title, detail, `flag-${row.id}`);
          fireSocAlert("high", "fraud", title, detail, row.id);
        }
      )
      // Major trust score drops
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trust_history" },
        (payload) => {
          const row = payload.new as any;
          if (row.trust_delta < -20) {
            const title = "Critical Trust Drop";
            const detail = `User trust dropped ${row.trust_delta} points (now ${row.trust_score_at_time})`;
            showNotification("📉 " + title, detail, `trust-${row.id}`);
            fireSocAlert("critical", "trust", title, detail, row.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, user, fireSocAlert]);
};
