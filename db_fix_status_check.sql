-- Fix: Add 'rejected' to the orders status check constraint
-- The current constraint only allows: pending, completed, cancelled

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'completed', 'cancelled', 'rejected'));
