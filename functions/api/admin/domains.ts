// /api/admin/domains - Domain management

import type { Env, Domain, AdminDomainListItem, DnsRecord } from '../../lib/types';
import { requireAdmin, successResponse, errorResponse } from '../../lib/auth';
import { CloudflareDNSClient } from '../../lib/cloudflare-dns';
import { createNotification } from '../../lib/notifications';

// GET /api/admin/domains - Get domains list
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const authResult = await requireAdmin(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    let whereClause = '1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (d.label LIKE ? OR d.fqdn LIKE ? OR u.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status !== 'all') {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    console.log('[Admin Domains] Query params:', { whereClause, params, limit, offset });

    const { results } = await env.DB.prepare(`
      SELECT d.id, d.label, d.fqdn, d.owner_linuxdo_id, u.username as owner_username,
             d.status, d.review_reason, d.created_at
      FROM domains d
      LEFT JOIN users u ON d.owner_linuxdo_id = u.linuxdo_id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<AdminDomainListItem>();

    console.log('[Admin Domains] Results count:', results?.length || 0);

    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM domains d
      LEFT JOIN users u ON d.owner_linuxdo_id = u.linuxdo_id
      WHERE ${whereClause}
    `).bind(...params).first<{ count: number }>();

    return successResponse({
      domains: results || [],
      total: countResult?.count || 0,
    });
  } catch (e) {
    console.error('[Admin Domains] Error:', e);
    console.error('[Admin Domains] Error message:', e instanceof Error ? e.message : String(e));
    console.error('[Admin Domains] Error stack:', e instanceof Error ? e.stack : 'No stack');
    return errorResponse(`Failed to get domains: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
};

// POST /api/admin/domains - Update domain status
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const authResult = await requireAdmin(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  let body: {
    id?: number;
    action?: 'suspend' | 'activate' | 'delete';
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { id, action, reason } = body;

  if (!id || typeof id !== 'number') {
    return errorResponse('Missing or invalid id', 400);
  }

  const validActions = ['suspend', 'activate', 'delete'];
  if (!action || !validActions.includes(action)) {
    return errorResponse('Invalid action', 400);
  }

  try {
    // Get domain
    const domain = await env.DB.prepare(
      'SELECT * FROM domains WHERE id = ?'
    ).bind(id).first<Domain>();

    if (!domain) {
      return errorResponse('Domain not found', 404);
    }

    const adminId = parseInt(authResult.user.sub, 10);
    const cfClient = new CloudflareDNSClient(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ZONE_ID);

    switch (action) {
      case 'suspend':
        // Get all DNS records for this domain
        const { results: dnsRecords } = await env.DB.prepare(
          'SELECT * FROM dns_records WHERE domain_id = ?'
        ).bind(id).all<DnsRecord>();

        // Delete all DNS records from Cloudflare
        await cfClient.deleteAllRecords(domain.fqdn);

        // Mark all DNS records as not synced in database (keep them as evidence)
        if (dnsRecords && dnsRecords.length > 0) {
          await env.DB.prepare(
            'UPDATE dns_records SET cf_synced = 0 WHERE domain_id = ?'
          ).bind(id).run();
        }

        // Update domain status to suspended
        await env.DB.prepare(`
          UPDATE domains SET status = 'suspended', suspend_reason = ?
          WHERE id = ?
        `).bind(reason.trim(), id).run();

        // Send notification to user
        await createNotification(
          env.DB,
          domain.owner_linuxdo_id,
          'domain_suspended',
          '域名已被暂停',
          `您的域名 ${domain.fqdn} 已被暂停使用。暂停原因：${reason.trim()}`
        );
        break;

      case 'activate':
        // Get all DNS records that need to be restored
        const { results: recordsToRestore } = await env.DB.prepare(
          'SELECT * FROM dns_records WHERE domain_id = ? AND cf_synced = 0'
        ).bind(id).all<DnsRecord>();

        // Restore DNS records to Cloudflare
        if (recordsToRestore && recordsToRestore.length > 0) {
          for (const record of recordsToRestore) {
            try {
              const dnsName = record.name === '@' ? domain.fqdn : `${record.name}.${domain.fqdn}`;
              await cfClient.createDNSRecord(
                record.type,
                dnsName,
                record.content,
                record.ttl,
                record.proxied === 1
              );
            } catch (e) {
              console.error(`Failed to restore DNS record ${record.id}:`, e);
              // Continue with other records even if one fails
            }
          }

          // Mark all records as synced
          await env.DB.prepare(
            'UPDATE dns_records SET cf_synced = 1 WHERE domain_id = ?'
          ).bind(id).run();
        }

        // Update domain status to active
        await env.DB.prepare(`
          UPDATE domains SET status = 'active', suspend_reason = NULL
          WHERE id = ?
        `).bind(id).run();

        // Send notification to user
        await createNotification(
          env.DB,
          domain.owner_linuxdo_id,
          'domain_unsuspended',
          '域名已解除暂停',
          `您的域名 ${domain.fqdn} 已解除暂停，现在可以正常使用了。`
        );
        break;

      case 'delete':
        // Delete all DNS records from Cloudflare
        await cfClient.deleteAllRecords(domain.fqdn);

        // Send notification to user about deletion
        await createNotification(
          env.DB,
          domain.owner_linuxdo_id,
          'domain_suspended', // reuse type for deletion notification
          '域名已被删除',
          `您的域名 ${domain.fqdn} 已被管理员删除。${reason ? `删除原因：${reason}` : ''}`
        );

        // Delete from database
        await env.DB.prepare('DELETE FROM domains WHERE id = ?').bind(id).run();
        break;
    }

    // Log the action
    await env.DB.prepare(`
      INSERT INTO audit_logs (linuxdo_id, action, target, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      adminId,
      `domain_${action}`,
      domain.fqdn,
      JSON.stringify({ reason, owner: domain.owner_linuxdo_id }),
      request.headers.get('CF-Connecting-IP')
    ).run();

    return successResponse({ updated: true, action });
  } catch (e) {
    console.error('Failed to update domain:', e);
    return errorResponse('Failed to update domain', 500);
  }
};
