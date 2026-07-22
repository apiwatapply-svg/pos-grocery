-- Rename user roles for the new permission system.
-- admin (cross-store) -> super_admin
-- owner (store-scoped) -> store_admin
UPDATE "User" SET role = 'super_admin' WHERE role = 'admin';
UPDATE "User" SET role = 'store_admin' WHERE role = 'owner';
