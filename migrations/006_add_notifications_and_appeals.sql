-- Add notifications table for message system
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linuxdo_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('domain_pending_review', 'domain_approved', 'domain_rejected', 'domain_suspended', 'domain_unsuspended', 'report_processed')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (linuxdo_id) REFERENCES users(linuxdo_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(linuxdo_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Add appeals table for domain suspension appeals
CREATE TABLE IF NOT EXISTS appeals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL,
    linuxdo_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at TEXT,
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (domain_id) REFERENCES domains(id),
    FOREIGN KEY (linuxdo_id) REFERENCES users(linuxdo_id),
    FOREIGN KEY (reviewed_by) REFERENCES users(linuxdo_id)
);

CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_domain ON appeals(domain_id);

-- Add cf_synced field to dns_records to track Cloudflare sync status
ALTER TABLE dns_records ADD COLUMN cf_synced INTEGER NOT NULL DEFAULT 1;
