-- Private cloud file storage for StudyFlow materials.
-- File objects are stored under <auth.uid()>/<material id>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studyflow-materials',
  'studyflow-materials',
  false,
  26214400,
  null
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "StudyFlow users read their own materials" on storage.objects;
create policy "StudyFlow users read their own materials"
on storage.objects for select to authenticated
using (
  bucket_id = 'studyflow-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "StudyFlow users upload their own materials" on storage.objects;
create policy "StudyFlow users upload their own materials"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'studyflow-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "StudyFlow users update their own materials" on storage.objects;
create policy "StudyFlow users update their own materials"
on storage.objects for update to authenticated
using (
  bucket_id = 'studyflow-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'studyflow-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "StudyFlow users delete their own materials" on storage.objects;
create policy "StudyFlow users delete their own materials"
on storage.objects for delete to authenticated
using (
  bucket_id = 'studyflow-materials'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
