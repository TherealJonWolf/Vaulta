
-- 1. Patch increment_failed_login to skip admin accounts
CREATE OR REPLACE FUNCTION public.increment_failed_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempts integer;
  v_locked boolean;
  v_user_id uuid;
  v_is_admin boolean := false;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE email = lower(p_email) LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    v_is_admin := public.has_role(v_user_id, 'admin'::app_role);
  END IF;

  IF v_is_admin THEN
    -- Admins are exempt: never increment, never lock
    UPDATE public.profiles
    SET failed_login_attempts = 0, account_locked_at = NULL
    WHERE user_id = v_user_id;
    RETURN jsonb_build_object('attempts', 0, 'locked', false, 'admin_exempt', true);
  END IF;

  UPDATE public.profiles
  SET failed_login_attempts = failed_login_attempts + 1,
      account_locked_at = CASE WHEN failed_login_attempts + 1 >= 6 THEN now() ELSE account_locked_at END
  WHERE email = lower(p_email)
  RETURNING failed_login_attempts, (account_locked_at IS NOT NULL) INTO v_attempts, v_locked;

  IF v_attempts IS NULL THEN
    RETURN jsonb_build_object('attempts', 0, 'locked', false);
  END IF;

  RETURN jsonb_build_object('attempts', v_attempts, 'locked', v_locked);
END;
$function$;

-- 2. Trigger: prevent locking admin profiles
CREATE OR REPLACE FUNCTION public.prevent_admin_lockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_locked_at IS NOT NULL
     AND public.has_role(NEW.user_id, 'admin'::app_role) THEN
    NEW.account_locked_at := NULL;
    NEW.failed_login_attempts := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_lockout ON public.profiles;
CREATE TRIGGER trg_prevent_admin_lockout
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_lockout();

-- 3. Trigger: prevent blacklisting an admin email
CREATE OR REPLACE FUNCTION public.prevent_admin_blacklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE email = lower(NEW.email) LIMIT 1;
  IF v_user_id IS NOT NULL AND public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Cannot blacklist admin account: %', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_blacklist ON public.blacklisted_emails;
CREATE TRIGGER trg_prevent_admin_blacklist
BEFORE INSERT ON public.blacklisted_emails
FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_blacklist();
