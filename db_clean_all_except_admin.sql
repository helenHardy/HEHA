-- ⚠️ PRECAUCIÓN: ESTE SCRIPT BORRA TODO MENOS EL ADMIN ⚠️
-- 1. Elimina Ventas, Items, Movimientos y Cierres de caja
-- 2. Elimina Productos y Categorías
-- 3. Elimina Todos los usuarios y perfiles (EXCEPTO admin@gmail.com)

BEGIN;

-- 1. Limpiar Datos Transaccionales (Orden, Items, Caja)
TRUNCATE TABLE public.order_items, public.orders, public.cash_moves, public.cash_register RESTART IDENTITY CASCADE;

-- 2. Limpiar Catálogo (Productos, Categorías)
-- Si quieres conservar el menú, comenta la siguiente línea:
TRUNCATE TABLE public.products, public.categories RESTART IDENTITY CASCADE;

-- 3. Limpiar Usuarios (Conservando al Admin)
-- Primero borramos perfiles que no sean admin
DELETE FROM public.profiles 
WHERE email NOT IN ('admin@gmail.com');

-- Luego intentamos borrar de auth.users (Si tienes permisos)
-- Nota: Esto puede requerir ser ejecutado desde el Dashboard de Supabase si SQL Editor no tiene permisos sobre auth
DELETE FROM auth.users 
WHERE email NOT IN ('admin@gmail.com');

COMMIT;
