-- Add document_category enum type
CREATE TYPE public.document_category AS ENUM ('identity', 'financial', 'general');

-- Add document_category column to documents table with default 'general'
ALTER TABLE public.documents ADD COLUMN document_category public.document_category NOT NULL DEFAULT 'general';