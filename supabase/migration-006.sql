-- ============================================================
-- Migration 006 — per-account default language for added books
-- Run once in the Supabase SQL editor on an existing database.
-- (New installs already get this from schema.sql.)
-- ============================================================

alter table public.profiles
  add column if not exists default_language text not null default '';
