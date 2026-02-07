-- FIX RLS FOR ORDERS DELETION
-- Allows authenticated staff (Admin/Cashier) to reject/delete orders.

-- 1. Orders table
CREATE POLICY "Staff Delete Orders" 
ON public.orders 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- 2. Also ensure they can update if needed (rare but good for status changes)
-- If a policy already exists this might fail, but checking existing ones 
-- standard POS setup usually allows broad access to authenticated roles.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Staff Update Orders'
    ) THEN
        CREATE POLICY "Staff Update Orders" ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 3. Order Items (Cascade delete should handle it if defined, but extra policy doesn't hurt)
CREATE POLICY "Staff Delete Order Items" 
ON public.order_items 
FOR DELETE 
USING (auth.role() = 'authenticated');
