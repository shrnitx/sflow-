-- Keep shared StudyFlow data private to each signed-in account and enable Realtime refreshes.
-- This migration has already been applied to the connected Supabase project.

alter table public.studyflow_tasks enable row level security;
alter table public.studyflow_timetable enable row level security;
alter table public.studyflow_focus_sessions enable row level security;
alter table public.studyflow_user_data enable row level security;

revoke all on public.studyflow_tasks from anon, public;
revoke all on public.studyflow_timetable from anon, public;
revoke all on public.studyflow_focus_sessions from anon, public;
revoke all on public.studyflow_user_data from anon, public;

grant select, insert, update, delete on public.studyflow_tasks to authenticated;
grant select, insert, update, delete on public.studyflow_timetable to authenticated;
grant select, insert, update, delete on public.studyflow_focus_sessions to authenticated;
grant select, insert, update, delete on public.studyflow_user_data to authenticated;

do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Expected Supabase publication supabase_realtime was not found';
  end if;

  foreach table_name in array array[
    'studyflow_tasks',
    'studyflow_timetable',
    'studyflow_focus_sessions',
    'studyflow_user_data'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
