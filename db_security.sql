-- SECURITY HARDENING SCRIPT
-- Run this to fix "RLS Disabled" warnings and secure your data.

-- 1. Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_moves ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies
-- TIP: For a POS, usually any 'authenticated' user (cashier/admin) needs read/write access.
-- We can refine this later to restrict Cashiers from deleting, etc.

-- PRODUCTS & CATEGORIES (Read Public, Write Auth)
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Auth Write Products" ON public.products FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Auth Write Categories" ON public.categories FOR ALL USING (auth.role() = 'authenticated');

-- ORDERS (Auth Only)
CREATE POLICY "Staff Full Access Orders" ON public.orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Full Access Order Items" ON public.order_items FOR ALL USING (auth.role() = 'authenticated');

-- CASH REGISTER (Auth Only)
CREATE POLICY "Staff Full Access Sessions" ON public.cash_register_sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Full Access Moves" ON public.cash_moves FOR ALL USING (auth.role() = 'authenticated');

-- 3. Fix Profiles (Ensure Admin can manage users)
-- (Already handled in previous scripts, but good to double check)
