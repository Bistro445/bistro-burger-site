-- Demandes envoyées depuis les formulaires (page Noël, puis devis traiteur) et compteur de clics des pages.
-- À exécuter UNE SEULE FOIS : Supabase > projet "bistro-burger" > SQL Editor > New query > coller > Run.
-- Les tables sont fermées au public (aucune politique) : seul le serveur du site (clé de service) y accède,
-- et les données ne s'affichent que dans l'espace admin. Tant que ce script n'est pas exécuté, les demandes
-- partent quand même par e-mail : seul l'historique dans l'admin et le compteur de clics manquent.

create table if not exists public.demandes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null default 'noel',          -- 'noel' aujourd'hui, 'devis' plus tard
  prestation text,
  date_souhaitee date,
  personnes integer,
  type_client text,                              -- particulier / entreprise / association
  societe text,
  nom text not null,
  telephone text not null,
  email text not null,
  message text,
  consentement boolean not null default false,
  statut text not null default 'nouveau'         -- nouveau / traité
);

alter table public.demandes enable row level security;

create table if not exists public.page_events (
  page text not null,
  event text not null,
  day date not null default current_date,
  count bigint not null default 0,
  primary key (page, event, day)
);

alter table public.page_events enable row level security;

-- Ajoute 1 au compteur d'un bouton (appelée par le serveur, jamais par les visiteurs).
create or replace function public.increment_page_event(p_page text, p_event text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.page_events (page, event, day, count)
  values (p_page, p_event, current_date, 1)
  on conflict (page, event, day) do update
    set count = public.page_events.count + 1;
$$;

revoke all on function public.increment_page_event(text, text) from public, anon, authenticated;
grant execute on function public.increment_page_event(text, text) to service_role;

-- Indispensable sur ce projet Supabase : les nouveaux tableaux ne donnent AUCUN droit par défaut, même au serveur
-- (sans ces lignes, l'enregistrement échoue sans message visible). Aucun droit pour le public (anon / authenticated).
grant select, insert, update, delete on public.demandes to service_role;
grant select, insert, update, delete on public.page_events to service_role;
notify pgrst, 'reload schema';
