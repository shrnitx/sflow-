-- Store StudyFlow focus sessions in the signed-in user's own cloud data.
create table if not exists public.studyflow_focus_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_id)
);

alter table public.studyflow_focus_sessions enable row level security;
revoke all on public.studyflow_focus_sessions from anon, public;
grant select, insert, update, delete on public.studyflow_focus_sessions to authenticated;

drop policy if exists studyflow_focus_sessions_select_own on public.studyflow_focus_sessions;
create policy studyflow_focus_sessions_select_own on public.studyflow_focus_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists studyflow_focus_sessions_insert_own on public.studyflow_focus_sessions;
create policy studyflow_focus_sessions_insert_own on public.studyflow_focus_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists studyflow_focus_sessions_update_own on public.studyflow_focus_sessions;
create policy studyflow_focus_sessions_update_own on public.studyflow_focus_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists studyflow_focus_sessions_delete_own on public.studyflow_focus_sessions;
create policy studyflow_focus_sessions_delete_own on public.studyflow_focus_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);
