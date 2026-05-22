-- Migration 008: add social link fields to members table
-- Creators can link Instagram, TikTok, and a website to their storefront.
-- All columns are nullable — existing rows are unaffected.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_handle     TEXT,
  ADD COLUMN IF NOT EXISTS website_url       TEXT;
