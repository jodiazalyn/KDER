-- ============================================================
-- 012 — Catering inclusion groups
-- ============================================================
-- Replaces the free-text `catering_inclusions` column with a structured
-- JSONB groups column. Old column is kept for back-compat with listings
-- created before this PR — the form prefers the new column when both
-- are set.
--
-- Shape:
--   {
--     "Protein":          ["Grilled Chicken", "Cajun Chicken"],
--     "Sides":            ["Mac & Cheese", "Yellow Rice"],
--     "Desserts":         ["Peach Cobbler"],
--     "Add-ons":          ["Cornbread Muffins"],
--     "Drinks":           ["Sweet Tea"],
--     "Toppings/Sauces":  ["BBQ Sauce"]
--   }
--
-- We don't enforce the category keys at the DB layer — the type system
-- in src/types/index.ts is authoritative. Lets us add categories later
-- without a schema change.
-- ============================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS catering_inclusion_groups jsonb NOT NULL DEFAULT '{}'::jsonb;
