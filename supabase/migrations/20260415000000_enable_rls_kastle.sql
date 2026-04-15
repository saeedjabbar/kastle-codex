-- Enable Row-Level Security on kastle table
-- All application access uses service_role key which bypasses RLS.
-- This prevents anonymous/public access to the table.
ALTER TABLE public.kastle ENABLE ROW LEVEL SECURITY;
