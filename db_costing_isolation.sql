-- Professional Costing & Branch Isolation Migration

-- 1. Update ingredients table with costing fields
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchase_amount DECIMAL(10, 2) DEFAULT 1, -- Amount of units in the purchase (e.g., 8 pieces)
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Fixed Branch-Isolated Deduction Trigger
-- This version finds the target ingredient in the LOCAL branch matching the name of the ingredient in the recipe.
CREATE OR REPLACE FUNCTION public.handle_ingredient_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_id BIGINT;
BEGIN
    SELECT branch_id INTO v_branch_id FROM public.orders WHERE id = NEW.order_id;

    -- Update ingredients in the active branch where the NAME matches the recipe's ingredient
    UPDATE public.ingredients i
    SET stock = i.stock - (pi.quantity * NEW.quantity)
    FROM public.product_ingredients pi
    JOIN public.ingredients template_i ON pi.ingredient_id = template_i.id
    WHERE pi.product_id = NEW.product_id
      AND i.name = template_i.name
      AND i.branch_id = v_branch_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Fixed Branch-Isolated Restoration Trigger
CREATE OR REPLACE FUNCTION public.handle_ingredient_restoration()
RETURNS TRIGGER AS $$
DECLARE
    v_branch_id BIGINT;
BEGIN
    SELECT branch_id INTO v_branch_id FROM public.orders WHERE id = OLD.order_id;

    UPDATE public.ingredients i
    SET stock = i.stock + (pi.quantity * OLD.quantity)
    FROM public.product_ingredients pi
    JOIN public.ingredients template_i ON pi.ingredient_id = template_i.id
    WHERE pi.product_id = OLD.product_id
      AND i.name = template_i.name
      AND i.branch_id = v_branch_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
