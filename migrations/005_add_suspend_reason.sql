-- Add suspend_reason to domains table
ALTER TABLE domains ADD COLUMN suspend_reason TEXT;
