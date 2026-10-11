create table if not exists public.studyflow_user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studyflow_user_data_pkey primary key (user_id, record_id),
  constraint studyflow_user_data_object_check check (jsonb_typeof(data) = 'object')
);

alter table public.studyflow_user_data enable row level security;

grant select, insert, update, delete on table public.studyflow_user_data to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studyflow_user_data'
      and policyname = 'studyflow_user_data_select_own'
  ) then
    create policy studyflow_user_data_select_own
      on public.studyflow_user_data for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studyflow_user_data'
      and policyname = 'studyflow_user_data_insert_own'
  ) then
    create policy studyflow_user_data_insert_own
      on public.studyflow_user_data for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studyflow_user_data'
      and policyname = 'studyflow_user_data_update_own'
  ) then
    create policy studyflow_user_data_update_own
      on public.studyflow_user_data for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studyflow_user_data'
      and policyname = 'studyflow_user_data_delete_own'
  ) then
    create policy studyflow_user_data_delete_own
      on public.studyflow_user_data for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

create index if not exists studyflow_user_data_updated_at_idx
  on public.studyflow_user_data (user_id, updated_at desc);