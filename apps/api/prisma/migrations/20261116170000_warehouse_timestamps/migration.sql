-- Existing rows keep NULL. The migration time is not a creation time.
ALTER TABLE "warehouses" ADD COLUMN "created_at" TIMESTAMPTZ(3);
ALTER TABLE "warehouses" ADD COLUMN "updated_at" TIMESTAMPTZ(3);
