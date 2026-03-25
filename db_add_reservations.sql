-- Migration: Add scheduled_time to orders for Reservations
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;
