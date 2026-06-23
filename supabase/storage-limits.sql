-- ============================================================
-- Harden the 'covers' storage bucket: cap size + restrict to images.
-- Run once in the Supabase SQL editor (after storage.sql).
-- (Covers are shrunk client-side to ~20-60KB, so 2 MB is generous.)
-- ============================================================

update storage.buckets
set
  file_size_limit = 2097152,  -- 2 MB
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
where id = 'covers';
