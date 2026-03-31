-- Enable realtime replication for products table
-- 1. Create the publication if it doesn't exist (standard for Supabase)
-- 2. Add products table to the publication

BEGIN;
  -- Add products table to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
COMMIT;
