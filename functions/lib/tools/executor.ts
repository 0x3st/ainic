// Tool Executor - 执行 AI 工具调用

import { executeWorkflow } from '../workflows';

interface ToolExecutionContext {
  db: D1Database;
  env: any;
  userId?: number;
}

/**
 * Execute a tool called by the AI
 */
export async function executeTool(
  toolName: string,
  toolInput: any,
  context: ToolExecutionContext
): Promise<any> {
  try {
    switch (toolName) {
      case 'check_domain_availability':
        return await executeWorkflow('CheckDomain', {
          input: { label: toolInput.label },
          db: context.db,
          env: context.env,
        });

      case 'register_domain':
        if (!context.userId) {
          return {
            success: false,
            error: 'Authentication required. Please log in to register a domain.',
          };
        }
        return await executeWorkflow('RegisterDomain', {
          input: {
            label: toolInput.label,
            userId: context.userId,
            initialDNS: toolInput.initialDNS,
          },
          db: context.db,
          env: context.env,
          userId: context.userId,
        });

      case 'list_dns_records':
        if (!context.userId) {
          return { success: false, error: 'Authentication required' };
        }
        return await executeWorkflow('ManageDNS', {
          input: { userId: context.userId, action: 'list' },
          db: context.db,
          env: context.env,
          userId: context.userId,
        });

      case 'add_dns_record':
        if (!context.userId) {
          return { success: false, error: 'Authentication required' };
        }
        return await executeWorkflow('ManageDNS', {
          input: {
            userId: context.userId,
            action: 'add',
            record: {
              type: toolInput.type,
              name: toolInput.name,
              content: toolInput.content,
              ttl: toolInput.ttl,
              proxied: toolInput.proxied,
            },
          },
          db: context.db,
          env: context.env,
          userId: context.userId,
        });

      case 'update_dns_record':
        if (!context.userId) {
          return { success: false, error: 'Authentication required' };
        }
        return await executeWorkflow('ManageDNS', {
          input: {
            userId: context.userId,
            action: 'update',
            recordId: toolInput.recordId,
            record: {
              type: toolInput.type,
              name: toolInput.name,
              content: toolInput.content,
              ttl: toolInput.ttl,
              proxied: toolInput.proxied,
            },
          },
          db: context.db,
          env: context.env,
          userId: context.userId,
        });

      case 'delete_dns_record':
        if (!context.userId) {
          return { success: false, error: 'Authentication required' };
        }
        return await executeWorkflow('ManageDNS', {
          input: {
            userId: context.userId,
            action: 'delete',
            recordId: toolInput.recordId,
          },
          db: context.db,
          env: context.env,
          userId: context.userId,
        });

      case 'get_my_domain_status':
        if (!context.userId) {
          return { success: false, error: 'Authentication required' };
        }
        const domain = await context.db.prepare(
          'SELECT label, fqdn, status, created_at FROM domains WHERE owner_id = ?'
        ).bind(context.userId).first();

        if (!domain) {
          return {
            success: true,
            data: { hasDomain: false, message: 'No domain registered yet' },
          };
        }

        const dnsCount = await context.db.prepare(
          'SELECT COUNT(*) as count FROM dns_records WHERE domain_id = (SELECT id FROM domains WHERE owner_id = ?)'
        ).bind(context.userId).first();

        return {
          success: true,
          data: {
            hasDomain: true,
            domain: {
              label: domain.label,
              fqdn: domain.fqdn,
              status: domain.status,
              dnsRecords: dnsCount?.count || 0,
              createdAt: domain.created_at,
            },
          },
        };

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}
