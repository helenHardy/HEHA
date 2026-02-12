-- Create EXPENSES table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric not null,
  expense_type text not null check (expense_type in ('daily', 'fixed')), -- 'daily' or 'fixed'
  category text, -- e.g., 'transporte', 'alquiler', 'servicios'
  expense_date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id)
);

-- Enable RLS
alter table public.expenses enable row level security;

-- Policies
create policy "Enable read access for authenticated users"
on public.expenses for select
using (auth.role() = 'authenticated');

create policy "Enable insert for authenticated users"
on public.expenses for insert
with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users"
on public.expenses for update
using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users"
on public.expenses for delete
using (auth.role() = 'authenticated');

-- Grant permissions (if needed, usually handled by authenticated role)
grant all on public.expenses to authenticated;
grant all on public.expenses to service_role;
