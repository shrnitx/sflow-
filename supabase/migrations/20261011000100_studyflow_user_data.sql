-- Run this file in the Supabase SQL Editor before using cloud sync.
create table if not exists public.studyflow_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

create table if not exists public.studyflow_timetable (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

alter table public.studyflow_tasks enable row level security;
alter table public.studyflow_timetable enable row level security;

-- Remove any broad table grants before granting access to signed-in users only.
revoke all on public.studyflow_tasks from anon, public;
revoke all on public.studyflow_timetable from anon, public;

grant select, insert, update, delete on public.studyflow_tasks to authenticated;
grant select, insert, update, delete on public.studyflow_timetable to authenticated;

drop policy if exists studyflow_tasks_select_own on public.studyflow_tasks;
create policy studyflow_tasks_select_own on public.studyflow_tasks
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists studyflow_tasks_insert_own on public.studyflow_tasks;
create policy studyflow_tasks_insert_own on public.studyflow_tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists studyflow_tasks_update_own on public.studyflow_tasks;
create policy studyflow_tasks_update_own on public.studyflow_tasks
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists studyflow_tasks_delete_own on public.studyflow_tasks;
create policy studyflow_tasks_delete_own on public.studyflow_tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists studyflow_timetable_select_own on public.studyflow_timetable;
create policy studyflow_timetable_select_own on public.studyflow_timetable
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists studyflow_timetable_insert_own on public.studyflow_timetable;
create policy studyflow_timetable_insert_own on public.studyflow_timetable
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists studyflow_timetable_update_own on public.studyflow_timetable;
create policy studyflow_timetable_update_own on public.studyflow_timetable
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists studyflow_timetable_delete_own on public.studyflow_timetable;
create policy studyflow_timetable_delete_own on public.studyflow_timetable
  for delete to authenticated using ((select auth.uid()) = user_id);
