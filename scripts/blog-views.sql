-- Compteur de consultations des articles du blog.
-- À exécuter UNE SEULE FOIS : Supabase > projet "bistro-burger" > SQL Editor > New query > coller > Run.
-- La table est fermée au public (aucune politique) : seul le serveur du site (clé de service) y accède,
-- et les chiffres ne s'affichent que dans l'espace admin.

create table if not exists public.blog_views (
  slug text primary key,
  views bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.blog_views enable row level security;

-- Ajoute 1 consultation à un article (appelée par le serveur, jamais par les visiteurs).
create or replace function public.increment_blog_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.blog_views (slug, views, updated_at)
  values (p_slug, 1, now())
  on conflict (slug) do update
    set views = public.blog_views.views + 1,
        updated_at = now();
$$;

revoke all on function public.increment_blog_view(text) from public, anon, authenticated;
grant execute on function public.increment_blog_view(text) to service_role;
