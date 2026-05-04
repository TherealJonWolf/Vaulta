
CREATE POLICY "Admins can insert institutional users"
ON public.institutional_users FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete institutional users"
ON public.institutional_users FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
