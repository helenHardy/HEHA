-- ============================================
-- MIGRATION: DYNAMIC RECIPES (CONDITION-BASED STOCK)
-- ============================================

-- 1. Add usage_condition column
ALTER TABLE public.product_ingredients 
ADD COLUMN IF NOT EXISTS usage_condition TEXT DEFAULT 'always' 
CHECK (usage_condition IN ('always', 'llevar', 'mesa', 'whatsapp'));

-- 2. Update Ingredient Deduction Trigger Function
CREATE OR REPLACE FUNCTION public.handle_ingredient_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_order_type TEXT;
BEGIN
    -- Get the order_type from the parent order
    SELECT order_type INTO v_order_type 
    FROM public.orders 
    WHERE id = NEW.order_id;

    -- Deduct ingredient stock based on recipe AND order_type match
    UPDATE public.ingredients i
    SET stock = i.stock - (pi.quantity * NEW.quantity)
    FROM public.product_ingredients pi
    WHERE pi.product_id = NEW.product_id
      AND pi.ingredient_id = i.id
      AND (
          pi.usage_condition = 'always' 
          OR pi.usage_condition = v_order_type
      );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update Ingredient Restoration Trigger Function (for deletions/cancellations)
CREATE OR REPLACE FUNCTION public.handle_ingredient_restoration()
RETURNS TRIGGER AS $$
DECLARE
    v_order_type TEXT;
BEGIN
    -- Get the order_type from the parent order
    SELECT order_type INTO v_order_type 
    FROM public.orders 
    WHERE id = OLD.order_id;

    -- Restore ingredient stock based on recipe AND order_type match
    UPDATE public.ingredients i
    SET stock = i.stock + (pi.quantity * OLD.quantity)
    FROM public.product_ingredients pi
    WHERE pi.product_id = OLD.product_id
      AND pi.ingredient_id = i.id
      AND (
          pi.usage_condition = 'always' 
          OR pi.usage_condition = v_order_type
      );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-create triggers (just in case, though function update is enough for existing triggers)
DROP TRIGGER IF EXISTS after_order_item_deduct_ingredients ON public.order_items;
CREATE TRIGGER after_order_item_deduct_ingredients
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_ingredient_deduction();

DROP TRIGGER IF EXISTS after_order_item_restore_ingredients ON public.order_items;
CREATE TRIGGER after_order_item_restore_ingredients
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_ingredient_restoration();
