
-- Fix overly permissive insert policy - restrict to system/admin inserts or self-inserts
DROP POLICY "System can insert notifications" ON public.notifications;
CREATE POLICY "Users and system can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
