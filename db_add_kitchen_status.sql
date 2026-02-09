-- AGREGAR ESTADO DE COCINA A LAS ORDENES
-- Para control de Comandas

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='kitchen_status') THEN
        ALTER TABLE public.orders ADD COLUMN kitchen_status TEXT DEFAULT 'pending';
        ALTER TABLE public.orders ADD CONSTRAINT kitchen_status_check CHECK (kitchen_status IN ('pending', 'ready', 'delivered'));
    END IF;
END $$;

-- Actualizar órdenes existentes para que no tengan nulos si fuera necesario
UPDATE public.orders SET kitchen_status = 'pending' WHERE kitchen_status IS NULL;
