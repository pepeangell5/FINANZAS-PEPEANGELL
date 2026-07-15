-- Ejecuta este archivo una sola vez en Supabase SQL Editor.
-- Sustituye el correo antes de ejecutarlo.
do $$
declare
  admin_email text := 'REEMPLAZA-CON-TU-CORREO';
  admin_id uuid;
  ahorro_id uuid;
  reinversion_id uuid;
  operacion_id uuid;
  fijos_id uuid;
  personales_id uuid;
  imprevistos_id uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_id is null then
    raise exception 'No existe un usuario con el correo %', admin_email;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
  where id = admin_id;

  insert into finance.profiles (id, full_name, role)
  values (admin_id, admin_email, 'admin')
  on conflict (id) do update set role = 'admin';

  insert into finance.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (admin_id, 'Ahorro', 25, '#22c55e', 1)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into ahorro_id;

  insert into finance.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (admin_id, 'Reinversión', 15, '#16a34a', 2)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into reinversion_id;

  insert into finance.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (admin_id, 'Operación del negocio', 10, '#15803d', 3)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into operacion_id;

  insert into finance.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (admin_id, 'Gastos fijos personales', 30, '#6b7280', 4)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into fijos_id;

  insert into finance.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (admin_id, 'Gastos personales', 15, '#9ca3af', 5)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into personales_id;

  insert into finance.allocation_buckets (user_id, name, percentage, color, sort_order)
  values (admin_id, 'Oportunidad / Imprevistos', 5, '#84cc16', 6)
  on conflict (user_id, name) do update set percentage = excluded.percentage
  returning id into imprevistos_id;

  insert into finance.categories (user_id, allocation_bucket_id, name, color)
  values
    (admin_id, operacion_id, 'Operación del negocio', '#15803d'),
    (admin_id, fijos_id, 'Gastos fijos personales', '#6b7280'),
    (admin_id, personales_id, 'Gastos personales', '#9ca3af'),
    (admin_id, imprevistos_id, 'Oportunidad / Imprevistos', '#84cc16'),
    (admin_id, ahorro_id, 'Ahorro', '#22c55e'),
    (admin_id, reinversion_id, 'Reinversión', '#16a34a')
  on conflict (user_id, name) do nothing;

  insert into finance.income_categories (user_id, name, color)
  values
    (admin_id, 'Sueldo', '#22c55e'),
    (admin_id, 'Ventas', '#10b981'),
    (admin_id, 'Proyectos', '#14b8a6'),
    (admin_id, 'Reembolsos', '#0ea5e9'),
    (admin_id, 'Rendimientos', '#6366f1'),
    (admin_id, 'Extras', '#f59e0b')
  on conflict (user_id, name) do nothing;
end;
$$;
