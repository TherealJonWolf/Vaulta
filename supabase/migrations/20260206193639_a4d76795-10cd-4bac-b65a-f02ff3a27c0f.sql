-- Create trust score levels enum
CREATE TYPE public.trust_level AS ENUM ('restricted', 'low_trust', 'neutral', 'trusted', 'highly_trusted');

-- Create trust scores table to store user trust evaluations
CREATE TABLE public.trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trust_score INTEGER NOT NULL CHECK (trust_score >= 0 AND trust_score <= 100),
  trust_level trust_level NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('High', 'Medium', 'Low')),
  positive_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  negative_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;

-- Users can view their own trust scores
CREATE POLICY "Users can view their own trust scores"
ON public.trust_scores
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own trust scores
CREATE POLICY "Users can insert their own trust scores"
ON public.trust_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient user lookups
CREATE INDEX idx_trust_scores_user_id ON public.trust_scores(user_id);
CREATE INDEX idx_trust_scores_calculated_at ON public.trust_scores(calculated_at DESC);