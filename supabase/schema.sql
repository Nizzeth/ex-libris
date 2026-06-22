-- ============================================================
-- Biblioteca Personal — Supabase schema, triggers & RLS
-- Run this in the Supabase SQL editor (one time).
-- ============================================================

-- ------------------------------------------------------------
-- Helper: short url-safe slug
-- Uses gen_random_uuid() (built into Postgres core / pg_catalog),
-- so it needs no extensions and resolves under any search_path.
-- ------------------------------------------------------------
create or replace function public.gen_slug()
returns text
language sql
volatile
as $$
  -- 10 hex chars from a random UUID; collision-unlikely for a personal app
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
$$;

-- ------------------------------------------------------------
-- profiles : one row per auth user
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  library_slug    text unique not null default public.gen_slug(),
  library_public  boolean not null default false,
  theme           text not null default 'archive',
  default_language text not null default '',
  created_at      timestamptz not null default now()
);

-- Auto-create a profile whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- shelves
-- ------------------------------------------------------------
create table if not exists public.shelves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  is_public   boolean not null default false,
  share_slug  text unique not null default public.gen_slug(),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists shelves_user_idx on public.shelves(user_id);

-- ------------------------------------------------------------
-- books : a user's personal copy (catalog + personal layer combined for MVP)
-- ------------------------------------------------------------
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  authors     text not null default '',
  isbn13      text default '',
  isbn10      text default '',
  published   text default '',
  publisher   text default '',
  language    text default '',
  cover_url   text,
  status      text not null default 'to_read'
                check (status in ('to_read','reading','read','recommended')),
  rating      int not null default 0 check (rating between 0 and 5),
  tags        text[] not null default '{}',
  notes       text default '',
  reading_notes text default '',
  loan_status text not null default 'none'
                check (loan_status in ('none','borrowed','lent')),
  loan_party  text default '',
  date_started  date,
  date_finished date,
  sort_order  int not null default 0,
  added_at    timestamptz not null default now()
);
create index if not exists books_user_idx on public.books(user_id);

-- ------------------------------------------------------------
-- shelf_books : which books sit on which shelf (+ position)
-- ------------------------------------------------------------
create table if not exists public.shelf_books (
  shelf_id   uuid not null references public.shelves(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  position   int not null default 0,
  primary key (shelf_id, book_id)
);
create index if not exists shelf_books_book_idx on public.shelf_books(book_id);

-- ============================================================
-- SECURITY DEFINER helpers
-- These run as the function owner and bypass RLS on the tables
-- they read, which prevents the policies below from recursing
-- into each other (profiles <-> shelves <-> books).
-- ============================================================
create or replace function public.is_library_public(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = uid and p.library_public);
$$;

create or replace function public.user_has_public_shelf(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shelves s where s.user_id = uid and s.is_public);
$$;

create or replace function public.shelf_is_public(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shelves s where s.id = sid and s.is_public);
$$;

create or replace function public.shelf_owner_library_public(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shelves s join profiles p on p.id = s.user_id
    where s.id = sid and p.library_public
  );
$$;

create or replace function public.book_on_public_shelf(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shelf_books sb join shelves s on s.id = sb.shelf_id
    where sb.book_id = bid and s.is_public
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.shelves     enable row level security;
alter table public.books       enable row level security;
alter table public.shelf_books enable row level security;

-- ---------- profiles ----------
-- Owner: full access to own row.
drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Anyone (incl. anon) may read a profile if its library is public,
-- or if the user owns at least one public shelf (needed to show owner name on a shared shelf).
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select using (
    library_public
    or public.user_has_public_shelf(id)
  );

-- ---------- shelves ----------
drop policy if exists shelves_owner_all on public.shelves;
create policy shelves_owner_all on public.shelves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists shelves_public_read on public.shelves;
create policy shelves_public_read on public.shelves
  for select using (
    is_public
    or public.is_library_public(user_id)
  );

-- ---------- books ----------
drop policy if exists books_owner_all on public.books;
create policy books_owner_all on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anon/public read when:
--   (a) the owner's whole library is public, OR
--   (b) the book is on at least one public shelf.
drop policy if exists books_public_read on public.books;
create policy books_public_read on public.books
  for select using (
    public.is_library_public(user_id)
    or public.book_on_public_shelf(id)
  );

-- ---------- shelf_books ----------
drop policy if exists shelf_books_owner_all on public.shelf_books;
create policy shelf_books_owner_all on public.shelf_books
  for all using (
    exists (select 1 from public.shelves s where s.id = shelf_books.shelf_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.shelves s where s.id = shelf_books.shelf_id and s.user_id = auth.uid())
  );

drop policy if exists shelf_books_public_read on public.shelf_books;
create policy shelf_books_public_read on public.shelf_books
  for select using (
    public.shelf_is_public(shelf_id)
    or public.shelf_owner_library_public(shelf_id)
  );

-- ============================================================
-- Done. Realtime is optional; not required for this app.
-- ============================================================
