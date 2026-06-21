-- ============================================================
-- Migration 005 — per-account theme
-- Run once in the Supabase SQL editor on an existing database.
-- (New installs already get this from schema.sql.)
-- ============================================================

alter table public.profiles
  add column if not exists theme text not null default 'archive';
