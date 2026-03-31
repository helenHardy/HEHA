-- ENABLE REALTIME FOR ORDERS AND CHAT
-- This allows the frontend to listen for new orders and chat messages as they happen.

-- 1. Check if the publication exists and add the tables. 
-- Most Supabase projects have a 'supabase_realtime' publication by default.
BEGIN;
  -- Add the tables to the replication publication if they're not already there
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE order_messages;
COMMIT;

-- Note: If you get an error saying 'supabase_realtime' does not exist, 
-- you might need to create it first:
-- CREATE PUBLICATION supabase_realtime FOR TABLE orders, order_messages;

-- If you get an error saying the table is already in the publication, that's OK.
-- You can run them individually:
-- ALTER PUBLICATION supabase_realtime ADD TABLE order_messages;
