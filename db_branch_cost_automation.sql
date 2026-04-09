-- ============================================
-- MIGRATION: BRANCH-ISOLATED COSTING AUTOMATION
-- ============================================

-- 1. Add cost column to branch_products
ALTER TABLE public.branch_products 
ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2) DEFAULT 0;

-- 2. Migrate existing global product costs to all branches
UPDATE public.branch_products bp
SET cost = p.cost
FROM public.products p
WHERE bp.product_id = p.id AND bp.cost = 0;

-- 3. Function to Recalculate Product Cost for a Specific Branch
CREATE OR REPLACE FUNCTION public.refresh_branch_product_cost(p_branch_id BIGINT, p_product_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_total_cost DECIMAL(10, 2) := 0;
BEGIN
    -- Sum costs of all ingredients in the recipe for THIS branch
    SELECT SUM(pi.quantity * COALESCE(bi.unit_cost, 0))
    INTO v_total_cost
    FROM public.product_ingredients pi
    JOIN public.ingredients template_i ON pi.ingredient_id = template_i.id
    -- Find the same ingredient by NAME in the specific branch
    LEFT JOIN public.ingredients bi ON bi.name = template_i.name AND bi.branch_id = p_branch_id
    WHERE pi.product_id = p_product_id;

    -- Update branch_products table
    UPDATE public.branch_products
    SET cost = COALESCE(v_total_cost, 0)
    WHERE branch_id = p_branch_id AND product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger Function: Sync cost when an ingredient price changes
CREATE OR REPLACE FUNCTION public.sync_costs_on_ingredient_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if unit_cost changed
    IF (OLD.unit_cost IS DISTINCT FROM NEW.unit_cost) THEN
        -- Find all products that use this ingredient (by name match in branch)
        -- Note: We need to find products whose recipe uses an ingredient with the same name
        PERFORM public.refresh_branch_product_cost(NEW.branch_id, pi.product_id)
        FROM public.product_ingredients pi
        JOIN public.ingredients template_i ON pi.ingredient_id = template_i.id
        WHERE template_i.name = NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_costs_on_ingredient_update ON public.ingredients;
CREATE TRIGGER tr_sync_costs_on_ingredient_update
AFTER UPDATE ON public.ingredients
FOR EACH ROW
EXECUTE FUNCTION public.sync_costs_on_ingredient_update();

-- 5. Trigger Function: Sync cost when a recipe changes
CREATE OR REPLACE FUNCTION public.sync_costs_on_recipe_change()
RETURNS TRIGGER AS $$
DECLARE
    v_target_product_id BIGINT;
    r RECORD;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_target_product_id := OLD.product_id;
    ELSE
        v_target_product_id := NEW.product_id;
    END IF;

    -- Recalculate for ALL branches that have this product
    FOR r IN SELECT id FROM public.branches LOOP
        PERFORM public.refresh_branch_product_cost(r.id, v_target_product_id);
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_costs_on_recipe_change ON public.product_ingredients;
CREATE TRIGGER tr_sync_costs_on_recipe_change
AFTER INSERT OR UPDATE OR DELETE ON public.product_ingredients
FOR EACH ROW
EXECUTE FUNCTION public.sync_costs_on_recipe_change();
