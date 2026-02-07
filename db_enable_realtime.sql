-- ENABLE REALTIME FOR ORDERS
-- This allows the frontend to listen for new orders as they happen.

-- 1. Check if the publication exists and add the table. 
-- Most Supabase projects have a 'supabase_realtime' publication by default.
BEGIN;
  -- Add the table to the replication publication if it's not already there
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
COMMIT;

-- Note: If you get an error saying 'supabase_realtime' does not exist, 
-- you might need to create it first:
-- CREATE PUBLICATION supabase_realtime FOR TABLE orders;
