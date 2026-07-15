create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'user'))
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text not null default 'user';
create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null;
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.allocation_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  percentage numeric(5, 2) not null,
  color text not null default '#22c55e',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allocation_buckets_percentage_check check (percentage >= 0 and percentage <= 100),
  constraint allocation_buckets_unique_name unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_bucket_id uuid references public.allocation_buckets(id) on delete set null,
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_unique_name unique (user_id, name)
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  income_date date not null default current_date,
  concept text not null,
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incomes_amount_check check (amount > 0)
);

create table if not exists public.income_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#22c55e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_categories_unique_name unique (user_id, name)
);

alter table public.incomes add column if not exists income_category_id uuid references public.income_categories(id) on delete set null;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  expense_date date not null default current_date,
  concept text not null,
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_check check (amount > 0)
);

create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  concept text not null,
  amount numeric(12, 2) not null,
  due_date date not null,
  note text,
  status text not null default 'pending',
  paid_at date,
  expense_id uuid references public.expenses(id) on delete set null,
  is_recurring boolean not null default false,
  recurring_parent_id uuid references public.fixed_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_expenses_amount_check check (amount > 0),
  constraint fixed_expenses_status_check check (status in ('pending', 'paid'))
);

create index if not exists allocation_buckets_user_id_idx on public.allocation_buckets(user_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists categories_allocation_bucket_id_idx on public.categories(allocation_bucket_id);
create index if not exists incomes_user_id_income_date_idx on public.incomes(user_id, income_date desc);
create index if not exists income_categories_user_id_idx on public.income_categories(user_id);
create index if not exists incomes_income_category_id_idx on public.incomes(income_category_id);
create index if not exists expenses_user_id_expense_date_idx on public.expenses(user_id, expense_date desc);
create index if not exists expenses_category_id_idx on public.expenses(category_id);
create index if not exists fixed_expenses_user_id_due_date_idx on public.fixed_expenses(user_id, due_date asc);
create index if not exists fixed_expenses_category_id_idx on public.fixed_expenses(category_id);
create index if not exists fixed_expenses_expense_id_idx on public.fixed_expenses(expense_id);
create index if not exists fixed_expenses_recurring_parent_id_idx on public.fixed_expenses(recurring_parent_id);
create index if not exists fixed_expenses_user_recurring_due_date_idx on public.fixed_expenses(user_id, is_recurring, due_date asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_allocation_buckets_updated_at on public.allocation_buckets;
create trigger set_allocation_buckets_updated_at
before update on public.allocation_buckets
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_incomes_updated_at on public.incomes;
create trigger set_incomes_updated_at
before update on public.incomes
for each row execute function public.set_updated_at();

drop trigger if exists set_income_categories_updated_at on public.income_categories;
create trigger set_income_categories_updated_at
before update on public.income_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_fixed_expenses_updated_at on public.fixed_expenses;
create trigger set_fixed_expenses_updated_at
before update on public.fixed_expenses
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.allocation_buckets enable row level security;
alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.income_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.fixed_expenses enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can view their allocation buckets" on public.allocation_buckets;
create policy "Users can view their allocation buckets"
on public.allocation_buckets for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their allocation buckets" on public.allocation_buckets;
create policy "Users can insert their allocation buckets"
on public.allocation_buckets for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their allocation buckets" on public.allocation_buckets;
create policy "Users can update their allocation buckets"
on public.allocation_buckets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their allocation buckets" on public.allocation_buckets;
create policy "Users can delete their allocation buckets"
on public.allocation_buckets for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view their categories" on public.categories;
create policy "Users can view their categories"
on public.categories for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their categories" on public.categories;
create policy "Users can insert their categories"
on public.categories for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their categories" on public.categories;
create policy "Users can update their categories"
on public.categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their categories" on public.categories;
create policy "Users can delete their categories"
on public.categories for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view their incomes" on public.incomes;
create policy "Users can view their incomes"
on public.incomes for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their incomes" on public.incomes;
create policy "Users can insert their incomes"
on public.incomes for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their incomes" on public.incomes;
create policy "Users can update their incomes"
on public.incomes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their incomes" on public.incomes;
create policy "Users can delete their incomes"
on public.incomes for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view their income categories" on public.income_categories;
create policy "Users can view their income categories"
on public.income_categories for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their income categories" on public.income_categories;
create policy "Users can insert their income categories"
on public.income_categories for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their income categories" on public.income_categories;
create policy "Users can update their income categories"
on public.income_categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their income categories" on public.income_categories;
create policy "Users can delete their income categories"
on public.income_categories for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view their expenses" on public.expenses;
create policy "Users can view their expenses"
on public.expenses for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their expenses" on public.expenses;
create policy "Users can insert their expenses"
on public.expenses for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their expenses" on public.expenses;
create policy "Users can update their expenses"
on public.expenses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their expenses" on public.expenses;
create policy "Users can delete their expenses"
on public.expenses for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view their fixed expenses" on public.fixed_expenses;
create policy "Users can view their fixed expenses"
on public.fixed_expenses for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their fixed expenses" on public.fixed_expenses;
create policy "Users can insert their fixed expenses"
on public.fixed_expenses for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their fixed expenses" on public.fixed_expenses;
create policy "Users can update their fixed expenses"
on public.fixed_expenses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their fixed expenses" on public.fixed_expenses;
create policy "Users can delete their fixed expenses"
on public.fixed_expenses for delete
using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ahorro_id uuid;
  reinversion_id uuid;
  operacion_id uuid;
  fijos_id uuid;
  personales_id uuid;
  imprevistos_id uuid;
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', new.email),
    nullif(new.raw_user_meta_data->>'username', '')
  )
  on conflict (id) do nothing;

  insert into public.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (new.id, 'Ahorro', 25, '#22c55e', 1)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into ahorro_id;

  insert into public.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (new.id, 'Reinversión', 15, '#16a34a', 2)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into reinversion_id;

  insert into public.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (new.id, 'Operación del negocio', 10, '#15803d', 3)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into operacion_id;

  insert into public.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (new.id, 'Gastos fijos personales', 30, '#6b7280', 4)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into fijos_id;

  insert into public.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (new.id, 'Gastos personales', 15, '#9ca3af', 5)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into personales_id;

  insert into public.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (new.id, 'Oportunidad / Imprevistos', 5, '#84cc16', 6)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into imprevistos_id;

  insert into public.categories (user_id, allocation_bucket_id, name, color)
  values
    (new.id, operacion_id, 'Operación del negocio', '#15803d'),
    (new.id, fijos_id, 'Gastos fijos personales', '#6b7280'),
    (new.id, personales_id, 'Gastos personales', '#9ca3af'),
    (new.id, imprevistos_id, 'Oportunidad / Imprevistos', '#84cc16'),
    (new.id, ahorro_id, 'Ahorro', '#22c55e'),
    (new.id, reinversion_id, 'Reinversión', '#16a34a')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_default_income_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.income_categories (user_id, name, color)
  values
    (new.id, 'Sueldo', '#22c55e'),
    (new.id, 'Ventas', '#10b981'),
    (new.id, 'Proyectos', '#14b8a6'),
    (new.id, 'Reembolsos', '#0ea5e9'),
    (new.id, 'Rendimientos', '#6366f1'),
    (new.id, 'Extras', '#f59e0b')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_income_categories on auth.users;
create trigger on_auth_user_created_income_categories
after insert on auth.users
for each row execute function public.create_default_income_categories();

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, full_name, username) on public.profiles to authenticated;
grant update (full_name, username) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.allocation_buckets to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.incomes to authenticated;
grant select, insert, update, delete on public.income_categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.fixed_expenses to authenticated;
grant select on public.allocation_buckets to service_role;
grant select on public.categories to service_role;
grant select on public.incomes to service_role;
grant select on public.income_categories to service_role;
grant select on public.expenses to service_role;
grant select on public.fixed_expenses to service_role;
