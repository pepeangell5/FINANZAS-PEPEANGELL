-- Ejecuta este archivo una sola vez en Supabase SQL Editor.
-- Sustituye el correo antes de ejecutarlo.
do $$
declare
  admin_email text := 'REEMPLAZA-CON-TU-CORREO';
  admin_id uuid;
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

  update public.profiles
  set role = 'admin'
  where id = admin_id;
end;
$$;
