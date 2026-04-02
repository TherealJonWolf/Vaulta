
DROP POLICY "Authenticated users can submit testimonials" ON public.testimonials;

CREATE POLICY "Authenticated users can submit own testimonials"
ON public.testimonials FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
