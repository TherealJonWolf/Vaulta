CREATE OR REPLACE FUNCTION public.is_admin_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE lower(p.email) = lower(p_email)
      AND ur.role = 'admin'::public.app_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_email(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_admin_lockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_locked_at IS NOT NULL
     AND public.has_role(NEW.user_id, 'admin'::public.app_role) THEN
    NEW.account_locked_at := NULL;
    NEW.failed_login_attempts := 0;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_admin_lockout() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_admin_lockout() TO service_role;

DROP TRIGGER IF EXISTS trg_prevent_admin_lockout ON public.profiles;
CREATE TRIGGER trg_prevent_admin_lockout
BEFORE UPDATE OF account_locked_at, failed_login_attempts ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_admin_lockout();

CREATE OR REPLACE FUNCTION public.prevent_admin_blacklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_email(NEW.email) THEN
    RAISE EXCEPTION 'Cannot blacklist protected admin account: %', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_admin_blacklist() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_admin_blacklist() TO service_role;

DROP TRIGGER IF EXISTS trg_prevent_admin_blacklist ON public.blacklisted_emails;
CREATE TRIGGER trg_prevent_admin_blacklist
BEFORE INSERT OR UPDATE OF email ON public.blacklisted_emails
FOR EACH ROW
EXECUTE FUNCTION public.prevent_admin_blacklist();