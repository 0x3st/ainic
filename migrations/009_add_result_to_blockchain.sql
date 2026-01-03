-- Add result field to blockchain_logs
ALTER TABLE blockchain_logs ADD COLUMN result TEXT DEFAULT 'success';
