-- Migration to add stock management
-- 1. Add columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT false;

-- 2. Create function to deduct stock
CREATE OR REPLACE FUNCTION public.handle_stock_deduction()
RETURNS TRIGGER AS $$
BEGIN
    -- Only deduct if the product is tracked
    UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id
    AND track_stock = true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on order_items insert
DROP TRIGGER IF EXISTS after_order_item_inserted ON public.order_items;
CREATE TRIGGER after_order_item_inserted
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_deduction();

-- 4. Create function to restore stock
CREATE OR REPLACE FUNCTION public.handle_stock_restoration()
RETURNS TRIGGER AS $$
BEGIN
    -- Return stock to product if tracked
    UPDATE public.products
    SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id
    AND track_stock = true;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on order_items delete
DROP TRIGGER IF EXISTS after_order_item_deleted ON public.order_items;
CREATE TRIGGER after_order_item_deleted
AFTER DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_restoration();
