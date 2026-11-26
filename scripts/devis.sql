-- Devis traiteur (page /devis-traiteur, api/devis.js, admin « Devis traiteur »).
-- À exécuter UNE SEULE FOIS : Supabase > projet "bistro-burger" > SQL Editor > New query > coller > Run.
-- Tables fermées au public (aucune politique) : seul le serveur du site (clé de service) y accède.

create table if not exists public.devis (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  numero text not null unique,                 -- DEV-2026-0001
  token text not null unique,                  -- lien unique non devinable : /devis-traiteur/d/<token>
  statut text not null default 'nouveau',      -- nouveau, envoye, accepte, refuse, expire, realise, facture
  valide_jusqu date,
  type_client text,                            -- entreprise / particulier / association
  nom text not null,
  societe text,
  siret text,
  telephone text not null,
  email text not null,
  adresse text,
  code_postal text,
  ville text,
  facturation text,
  remarques text,
  consentement boolean not null default false,
  offres boolean not null default false,       -- accord pour recevoir les offres (distinct)
  date_evenement date,
  heure text,
  convives integer,
  mode text,                                   -- livraison / retrait
  commune text,
  contenu jsonb not null default '{}'::jsonb,  -- lignes détaillées et totaux, calculés par le serveur
  saisie jsonb,                                -- choix bruts du client (pour refaire le devis)
  total_ht numeric(10,2),
  total_tva numeric(10,2),
  total_ttc numeric(10,2),
  acompte numeric(10,2),
  email_client text,
  email_restaurant text,
  historique jsonb not null default '[]'::jsonb,
  notes text,
  accepte_le timestamptz,
  ouvertures integer not null default 0,
  derniere_ouverture timestamptz,
  traite_par text,
  maj_le timestamptz
);

alter table public.devis enable row level security;
create index if not exists devis_created_at_idx on public.devis (created_at desc);

-- Numérotation chronologique par année (DEV-2026-0001, DEV-2026-0002…), sans trou ni doublon.
create table if not exists public.devis_compteur (
  annee integer primary key,
  dernier integer not null default 0
);
alter table public.devis_compteur enable row level security;

create or replace function public.next_devis_numero()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y integer := extract(year from (now() at time zone 'Europe/Paris'))::integer;
  n integer;
begin
  insert into public.devis_compteur (annee, dernier) values (y, 1)
  on conflict (annee) do update set dernier = public.devis_compteur.dernier + 1
  returning dernier into n;
  return 'DEV-' || y || '-' || lpad(n::text, 4, '0');
end;
$$;

revoke all on function public.next_devis_numero() from public, anon, authenticated;
grant execute on function public.next_devis_numero() to service_role;

-- Indispensable sur ce projet Supabase : sans ces lignes, le serveur n'a aucun droit sur les nouvelles tables.
grant select, insert, update, delete on public.devis to service_role;
grant select, insert, update, delete on public.devis_compteur to service_role;
notify pgrst, 'reload schema';

-- Avant l'ouverture aux clients, pour repartir de DEV-2026-0001 après les essais :
--   delete from public.devis where nom like 'TEST%';
--   update public.devis_compteur set dernier = 0 where annee = 2026;
