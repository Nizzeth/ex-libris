-- ============================================================
-- Migration 003 — borrowed / lent tracking
-- Run once in the Supabase SQL editor on an existing database.
-- (New installs already get these from schema.sql.)
-- ============================================================

alter table public.books
  add column if not exists loan_status text not null default 'none';

alter table public.books drop constraint if exists books_loan_status_check;
alter table public.books
  add constraint books_loan_status_check
  check (loan_status in ('none','borrowed','lent'));

-- Who it was borrowed from / lent to (optional free text).
alter table public.books
  add column if not exists loan_party text default '';
