create extension if not exists pgcrypto;

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_date date not null,
  item_type text not null check (item_type in ('text', 'voice')),
  text_content text,
  audio_path text,
  audio_mime_type text,
  audio_duration_seconds integer,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.calendar_items enable row level security;

drop policy if exists "Users can read own calendar items" on public.calendar_items;
create policy "Users can read own calendar items"
on public.calendar_items
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own calendar items" on public.calendar_items;
create policy "Users can insert own calendar items"
on public.calendar_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own calendar items" on public.calendar_items;
create policy "Users can update own calendar items"
on public.calendar_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own calendar items" on public.calendar_items;
create policy "Users can delete own calendar items"
on public.calendar_items
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('calendar-voice-notes', 'calendar-voice-notes', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own calendar voice notes" on storage.objects;
create policy "Users can read own calendar voice notes"
on storage.objects
for select
using (
  bucket_id = 'calendar-voice-notes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can upload own calendar voice notes" on storage.objects;
create policy "Users can upload own calendar voice notes"
on storage.objects
for insert
with check (
  bucket_id = 'calendar-voice-notes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own calendar voice notes" on storage.objects;
create policy "Users can update own calendar voice notes"
on storage.objects
for update
using (
  bucket_id = 'calendar-voice-notes'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'calendar-voice-notes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own calendar voice notes" on storage.objects;
create policy "Users can delete own calendar voice notes"
on storage.objects
for delete
using (
  bucket_id = 'calendar-voice-notes'
  and auth.uid()::text = (storage.foldername(name))[1]
);
