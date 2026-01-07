// Manage DNS Workflow - DNS 记录管理工作流

import { WorkflowDefinition, createStep, WorkflowContext, StepResult } from './engine';

export type DNSAction = 'add' | 'update' | 'delete' | 'list';

export interface ManageDNSInput {
  userId: number;
  action: DNSAction;
  recordId?: number; // For update/delete
  record?: {
    type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
    name: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  };
}

export interface ManageDNSOutput {
  success: boolean;
  message: string;
  records?: any[];
  recordId?: number;
}

export const ManageDNSWorkflow: WorkflowDefinition = {
  name: 'ManageDNS',
  description: 'Manage DNS records (add, update, delete, list)',

  steps: [
    // Step 1: Get user's domain
    createStep('getUserDomain', async (ctx: WorkflowContext): Promise<StepResult> => {
      const input = ctx.input as ManageDNSInput;

      try {
        const domain = await ctx.db.prepare(
          'SELECT id, label, fqdn, status FROM domains WHERE owner_id = ?'
        ).bind(input.userId).first();

        if (!domain) {
          return {
            success: false,
            error: 'You do not have a registered domain yet.',
          };
        }

        if (domain.status !== 'active') {
          return {
            success: false,
            error: `Domain is ${domain.status}. Only active domains can be managed.`,
          };
        }

        return { success: true, data: domain };
      } catch (error) {
        return {
          success: false,
          error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

    // Step 2: Execute DNS action
    createStep('executeDNSAction', async (ctx: WorkflowContext): Promise<StepResult> => {
      const input = ctx.input as ManageDNSInput;
      const domain = ctx.getUserDomain;

      try {
        switch (input.action) {
          case 'list':
            return await listDNSRecords(ctx, domain.id);

          case 'add':
            return await addDNSRecord(ctx, domain.id, input.record!);

          case 'update':
            return await updateDNSRecord(ctx, input.recordId!, input.record!);

          case 'delete':
            return await deleteDNSRecord(ctx, input.recordId!);

          default:
            return {
              success: false,
              error: `Unknown action: ${input.action}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to execute DNS action: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

    // Step 3: Sync to Cloudflare DNS (optional)
    createStep('syncToCloudflare', async (ctx: WorkflowContext): Promise<StepResult> => {
      // TODO: Integrate with Cloudflare DNS API
      // For now, just mark as synced in database

      const input = ctx.input as ManageDNSInput;

      if (input.action === 'list') {
        // No sync needed for list operation
        return { success: true, data: null };
      }

      // In production, this would call Cloudflare API
      // await syncRecordToCloudflare(recordId);

      return {
        success: true,
        data: { synced: false, message: 'Cloudflare DNS sync not yet implemented' },
      };
    }),
  ],
};

// Helper functions
async function listDNSRecords(ctx: WorkflowContext, domainId: number): Promise<StepResult> {
  const records = await ctx.db.prepare(
    'SELECT id, type, name, content, ttl, proxied, cf_synced FROM dns_records WHERE domain_id = ? ORDER BY id'
  ).bind(domainId).all();

  return {
    success: true,
    data: {
      records: records.results,
      count: records.results.length,
      message: `Found ${records.results.length} DNS records`,
    },
  };
}

async function addDNSRecord(ctx: WorkflowContext, domainId: number, record: any): Promise<StepResult> {
  // Validate record
  if (!record.type || !record.name || !record.content) {
    return { success: false, error: 'Missing required fields: type, name, content' };
  }

  // Check record limit (max 10)
  const count = await ctx.db.prepare(
    'SELECT COUNT(*) as count FROM dns_records WHERE domain_id = ?'
  ).bind(domainId).first();

  if (count && count.count >= 10) {
    return { success: false, error: 'Maximum 10 DNS records allowed per domain' };
  }

  // Insert record
  const result = await ctx.db.prepare(
    'INSERT INTO dns_records (domain_id, type, name, content, ttl, proxied) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    domainId,
    record.type,
    record.name,
    record.content,
    record.ttl || 3600,
    record.proxied ? 1 : 0
  ).run();

  return {
    success: true,
    data: {
      recordId: result.meta.last_row_id,
      message: `DNS record added successfully: ${record.type} ${record.name} → ${record.content}`,
    },
  };
}

async function updateDNSRecord(ctx: WorkflowContext, recordId: number, record: any): Promise<StepResult> {
  // Check if record exists
  const existing = await ctx.db.prepare(
    'SELECT id FROM dns_records WHERE id = ?'
  ).bind(recordId).first();

  if (!existing) {
    return { success: false, error: 'DNS record not found' };
  }

  // Update record
  await ctx.db.prepare(
    'UPDATE dns_records SET type = ?, name = ?, content = ?, ttl = ?, proxied = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(
    record.type,
    record.name,
    record.content,
    record.ttl || 3600,
    record.proxied ? 1 : 0,
    recordId
  ).run();

  return {
    success: true,
    data: {
      recordId,
      message: 'DNS record updated successfully',
    },
  };
}

async function deleteDNSRecord(ctx: WorkflowContext, recordId: number): Promise<StepResult> {
  // Check if record exists
  const existing = await ctx.db.prepare(
    'SELECT id FROM dns_records WHERE id = ?'
  ).bind(recordId).first();

  if (!existing) {
    return { success: false, error: 'DNS record not found' };
  }

  // Delete record
  await ctx.db.prepare(
    'DELETE FROM dns_records WHERE id = ?'
  ).bind(recordId).run();

  return {
    success: true,
    data: {
      message: 'DNS record deleted successfully',
    },
  };
}
