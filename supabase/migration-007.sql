-- ============================================================
-- Migration 007 — shelf colors
-- Run once in the Supabase SQL editor on an existing database.
-- (New installs already get this from schema.sql.)
-- shelves.sort_order already exists, so reordering needs no migration.
-- ============================================================

alter table public.shelves
  add column if not exists color text default '';
