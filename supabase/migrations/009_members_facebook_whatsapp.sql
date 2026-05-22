-- Migration 009: add Facebook handle and WhatsApp number to members table
-- All columns are nullable — existing rows are unaffected.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS facebook_handle  TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number  TEXT;
