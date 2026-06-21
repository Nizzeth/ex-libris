-- ============================================================
-- Migration 004 — reading dates (started / finished)
-- Run once in the Supabase SQL editor on an existing database.
-- (New installs already get these from schema.sql.)
-- ============================================================

alter table public.books add column if not exists date_started date;
alter table public.books add column if not exists date_finished date;
