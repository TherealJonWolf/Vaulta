
-- NIST 800-53 AC-7: Account lockout after failed login attempts
ALTER TABLE public.profiles ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN account_locked_at timestamptz;

-- Check if account is locked by email (public-facing, no auth required)
CREATE OR REPLACE FUNCTION public.check_account_locked(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT account_locked_at IS NOT NULL FROM public.profiles WHERE email = lower(p_email) LIMIT 1),
    false
  );
END;
$$;

-- Increment failed login attempts, lock at 6
CREATE OR REPLACE FUNCTION public.increment_failed_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_locked boolean;
BEGIN
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
$$;

-- Reset failed login attempts (on successful login or password reset)
CREATE OR REPLACE FUNCTION public.reset_failed_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET failed_login_attempts = 0, account_locked_at = NULL
  WHERE user_id = p_user_id;
END;
$$;
