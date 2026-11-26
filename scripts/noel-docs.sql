-- Espace de stockage des PDF de la page Noël (rubrique admin « Page Noël », public/admin/noel.js).
-- Exécuté dans Supabase (SQL Editor) le 26/11/2026. Lecture publique (les clients téléchargent),
-- dépôt et remplacement réservés aux comptes admin connectés. PDF uniquement, 5 Mo maximum.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-docs', 'site-docs', true, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

drop policy if exists "site_docs_authenticated_insert" on storage.objects;
drop policy if exists "site_docs_authenticated_update" on storage.objects;
drop policy if exists "site_docs_authenticated_select" on storage.objects;
drop policy if exists "site_docs_authenticated_delete" on storage.objects;
create policy "site_docs_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-docs');
create policy "site_docs_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'site-docs') with check (bucket_id = 'site-docs');
create policy "site_docs_authenticated_select" on storage.objects for select to authenticated using (bucket_id = 'site-docs');
create policy "site_docs_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'site-docs');
