-- Migration: Fix domains table status constraint to include 'pending' and 'review'
-- Run: wrangler d1 execute pykg-nic-db --remote --file=./migrations/007_fix_domains_status_constraint.sql

-- Disable foreign key checks temporarily
PRAGMA foreign_keys = OFF;

-- Step 1: Create new table with correct constraint
CREATE TABLE domains_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    fqdn TEXT NOT NULL UNIQUE,
    owner_linuxdo_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'review')),
    review_reason TEXT,
    python_praise TEXT,
    usage_purpose TEXT,
    dns_mode TEXT CHECK (dns_mode IN ('ns', 'direct')) DEFAULT 'direct',
    suspend_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_linuxdo_id) REFERENCES users(linuxdo_id)
);

-- Step 2: Copy data from old table
INSERT INTO domains_new (id, label, fqdn, owner_linuxdo_id, status, review_reason, python_praise, usage_purpose, dns_mode, suspend_reason, created_at)
SELECT id, label, fqdn, owner_linuxdo_id, status, review_reason, python_praise, usage_purpose, dns_mode, suspend_reason, created_at
FROM domains;

-- Step 3: Drop old table
DROP TABLE domains;

-- Step 4: Rename new table
ALTER TABLE domains_new RENAME TO domains;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_domains_owner ON domains(owner_linuxdo_id);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;
