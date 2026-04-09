-- SCRIPT: Move Today's Unassigned Sales to Pacajes Branch
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/bhogdzrahsoyqpnmkxfz/sql

DO $$
DECLARE
    v_branch_id BIGINT;
    v_target_date DATE := CURRENT_DATE; -- Moves everything from midnight today (UTC)
BEGIN
    -- 1. Get or Create the Pacajes branch
    SELECT id INTO v_branch_id FROM public.branches WHERE name ILIKE 'Pacajes' LIMIT 1;
    
    IF v_branch_id IS NULL THEN
        INSERT INTO public.branches (name, city) VALUES ('Pacajes', 'La Paz') RETURNING id INTO v_branch_id;
        RAISE NOTICE 'Sucursal Pacajes creada con ID: %', v_branch_id;
    ELSE
        RAISE NOTICE 'Sucursal Pacajes encontrada con ID: %', v_branch_id;
    END IF;

    -- 2. Update today's unassigned records (branch_id IS NULL)
    
    -- Update Orders
    UPDATE public.orders 
    SET branch_id = v_branch_id 
    WHERE created_at >= v_target_date 
      AND branch_id IS NULL;
    
    -- Update Cash Registers (sessions)
    UPDATE public.cash_register 
    SET branch_id = v_branch_id 
    WHERE created_at >= v_target_date 
      AND branch_id IS NULL;
    
    -- Update Cash Movements (payments)
    UPDATE public.cash_moves 
    SET branch_id = v_branch_id 
    WHERE created_at >= v_target_date 
      AND branch_id IS NULL;
    
    -- Update Expenses
    UPDATE public.expenses 
    SET branch_id = v_branch_id 
    WHERE created_at >= v_target_date 
      AND branch_id IS NULL;

    RAISE NOTICE 'Se han migrado las ventas y movimientos de hoy a la sucursal Pacajes correctamente.';
END $$;
