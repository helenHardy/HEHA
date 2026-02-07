-- FIX RLS FOR ORDERS
-- Ensure authenticated users can update orders (needed for Kiosk approval)

-- 1. Drop existing specific policy if it's too restrictive or name matches
-- DROP POLICY IF EXISTS "Staff Full Access Orders" ON public.orders;

-- 2. Create or Update the policy to be absolutely sure
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Allow Auth Update Orders'
    ) THEN
        CREATE POLICY "Allow Auth Update Orders" ON public.orders 
        FOR UPDATE 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

-- Also ensure SELECT is available for items (should be already, but to be safe)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Allow Auth Select Orders'
    ) THEN
        CREATE POLICY "Allow Auth Select Orders" ON public.orders 
        FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;
END $$;

GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.order_items TO authenticated;
GRANT ALL ON public.products TO authenticated;
