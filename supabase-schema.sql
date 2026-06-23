create extension if not exists pgcrypto;

create table if not exists public.dashboard_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  value text,
  item_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists dashboard_items_user_id_idx
  on public.dashboard_items (user_id);

create index if not exists dashboard_items_item_type_idx
  on public.dashboard_items (item_type);

create or replace function public.set_dashboard_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dashboard_items_updated_at on public.dashboard_items;

create trigger set_dashboard_items_updated_at
before update on public.dashboard_items
for each row
execute function public.set_dashboard_items_updated_at();

alter table public.dashboard_items enable row level security;

drop policy if exists "Users can read own dashboard items" on public.dashboard_items;
drop policy if exists "Users can insert own dashboard items" on public.dashboard_items;
drop policy if exists "Users can update own dashboard items" on public.dashboard_items;
drop policy if exists "Users can delete own dashboard items" on public.dashboard_items;

create policy "Users can read own dashboard items"
on public.dashboard_items
for select
using (auth.uid() = user_id);

create policy "Users can insert own dashboard items"
on public.dashboard_items
for insert
with check (auth.uid() = user_id);

create policy "Users can update own dashboard items"
on public.dashboard_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own dashboard items"
on public.dashboard_items
for delete
using (auth.uid() = user_id);
