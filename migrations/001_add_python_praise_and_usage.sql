-- Migration: Add python_praise and usage_purpose fields to domains, orders and pending_reviews tables
-- Run: wrangler d1 execute pykg-nic-db --file=./migrations/001_add_python_praise_and_usage.sql

-- Add python_praise column (TEXT, stores user's praise for Python)
ALTER TABLE domains ADD COLUMN python_praise TEXT;

-- Add usage_purpose column (TEXT, stores domain usage purpose)
ALTER TABLE domains ADD COLUMN usage_purpose TEXT;

-- Add python_praise and usage_purpose to orders table (for storing during payment flow)
ALTER TABLE orders ADD COLUMN python_praise TEXT;
ALTER TABLE orders ADD COLUMN usage_purpose TEXT;

-- Also add these fields to pending_reviews table for review workflow
ALTER TABLE pending_reviews ADD COLUMN python_praise TEXT;
ALTER TABLE pending_reviews ADD COLUMN usage_purpose TEXT;
