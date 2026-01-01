-- py.kg NIC D1 Database Schema
-- Run: wrangler d1 execute pykg-nic-db --file=./schema.sql

-- Users table: stores LinuxDO user info
CREATE TABLE IF NOT EXISTS users (
    linuxdo_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    trust_level INTEGER NOT NULL DEFAULT 0,
    silenced INTEGER NOT NULL DEFAULT 0,
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Domains table: one domain per user (enforced by UNIQUE on owner_linuxdo_id)
CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    fqdn TEXT NOT NULL UNIQUE,
    owner_linuxdo_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_linuxdo_id) REFERENCES users(linuxdo_id)
);

-- Audit logs table: track important operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linuxdo_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (linuxdo_id) REFERENCES users(linuxdo_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_domains_owner ON domains(owner_linuxdo_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(linuxdo_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
