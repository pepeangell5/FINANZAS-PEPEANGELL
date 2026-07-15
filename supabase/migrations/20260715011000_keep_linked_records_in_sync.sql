-- Keeps paid pending payments and their generated expenses as one logical record.
-- Deleting either side removes the linked record without touching unrelated data.
create or replace function public.delete_linked_expense_from_fixed_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.expense_id is not null and pg_trigger_depth() = 1 then
    delete from public.expenses
    where id = old.expense_id
      and user_id = old.user_id;
  end if;

  return old;
end;
$$;

create or replace function public.delete_linked_fixed_expense_from_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    delete from public.fixed_expenses
    where expense_id = old.id
      and user_id = old.user_id;
  end if;

  return old;
end;
$$;

drop trigger if exists delete_linked_expense_from_fixed_expense
on public.fixed_expenses;

create trigger delete_linked_expense_from_fixed_expense
before delete on public.fixed_expenses
for each row execute function public.delete_linked_expense_from_fixed_expense();

drop trigger if exists delete_linked_fixed_expense_from_expense
on public.expenses;

create trigger delete_linked_fixed_expense_from_expense
before delete on public.expenses
for each row execute function public.delete_linked_fixed_expense_from_expense();
