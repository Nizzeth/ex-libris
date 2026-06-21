-- ============================================================
-- Migration 002 — "Recommended" status + reading_notes field
-- Run once in the Supabase SQL editor on an existing database.
-- (New installs already get these from schema.sql.)
-- ============================================================

-- 1. Allow the new "recommended" status value.
alter table public.books drop constraint if exists books_status_check;
alter table public.books
  add constraint books_status_check
  check (status in ('to_read','reading','read','recommended'));

-- 2. Separate "Reading Notes" field (quotes / passages), alongside notes.
alter table public.books
  add column if not exists reading_notes text default '';
