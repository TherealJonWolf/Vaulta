import type { Session } from "@supabase/supabase-js";
import type { Location, NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type RoleRedirectTarget = "/vault" | "/institutional/dashboard" | "/landlord" | "/lender";

const REDIRECT_LOCK_MS = 3000;
let activeRedirectLock: { key: string; createdAt: number } | null = null;

export const getAuthSessionKey = (session: Session | null, userId?: string | null) => {
  if (session?.access_token) return `${session.user.id}:${session.access_token.slice(-20)}`;
  return userId ?? "anonymous";
};

export const shouldNavigateTo = (currentPath: string, targetPath: string) => {
  const normalizedCurrent = currentPath.replace(/\/+$/, "") || "/";
  const normalizedTarget = targetPath.replace(/\/+$/, "") || "/";
  return normalizedCurrent !== normalizedTarget;
};

export const navigateOnceForAuthTransition = ({
  navigate,
  location,
  targetPath,
  sessionKey,
  replace = true,
}: {
  navigate: NavigateFunction;
  location: Location;
  targetPath: string;
  sessionKey: string;
  replace?: boolean;
}) => {
  if (!shouldNavigateTo(location.pathname, targetPath)) return false;

  const lockKey = `${sessionKey}:${location.pathname}->${targetPath}`;
  const now = Date.now();
  if (activeRedirectLock?.key === lockKey && now - activeRedirectLock.createdAt < REDIRECT_LOCK_MS) {
    return false;
  }

  activeRedirectLock = { key: lockKey, createdAt: now };
  navigate(targetPath, { replace });
  return true;
};

export const resolveRoleRedirectTarget = async (userId: string): Promise<RoleRedirectTarget> => {
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = ((roleRows || []) as Array<{ role: string }>).map((row) => row.role);
  const isLandlord = roles.includes("landlord");
  const isLender = roles.includes("lender");

  if (isLandlord || isLender) {
    const { data: membership } = await (supabase.from as any)("institutional_users")
      .select("institution_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (membership?.institution_id) return "/institutional/dashboard";
    if (isLender) return "/lender";
    return "/landlord";
  }

  return "/vault";
};

export const resetAuthRedirectLocksForTests = () => {
  activeRedirectLock = null;
};