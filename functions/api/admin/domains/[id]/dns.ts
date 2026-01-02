// /api/admin/domains/[id]/dns - Admin DNS records management

import type { Env, DnsRecord } from '../../../../lib/types';
import { requireAdmin, successResponse, errorResponse } from '../../../../lib/auth';

// GET /api/admin/domains/:id/dns - Get DNS records for a domain
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  const authResult = await requireAdmin(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const domainId = parseInt(params.id as string, 10);

  if (isNaN(domainId)) {
    return errorResponse('Invalid domain ID', 400);
  }

  try {
    // Get domain
    const domain = await env.DB.prepare(
      'SELECT * FROM domains WHERE id = ?'
    ).bind(domainId).first();

    if (!domain) {
      return errorResponse('Domain not found', 404);
    }

    // Get DNS records
    const { results: dnsRecords } = await env.DB.prepare(
      'SELECT * FROM dns_records WHERE domain_id = ? ORDER BY type, name'
    ).bind(domainId).all<DnsRecord>();

    return successResponse({
      domain,
      dns_records: dnsRecords || []
    });
  } catch (e) {
    console.error('Failed to get DNS records:', e);
    return errorResponse('Failed to get DNS records', 500);
  }
};

// DELETE /api/admin/domains/:id/dns/:recordId - Delete a DNS record
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  const authResult = await requireAdmin(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const domainId = parseInt(params.id as string, 10);
  const url = new URL(request.url);
  const recordId = url.searchParams.get('record_id');

  if (isNaN(domainId) || !recordId) {
    return errorResponse('Invalid domain ID or record ID', 400);
  }

  try {
    // Get record
    const record = await env.DB.prepare(
      'SELECT * FROM dns_records WHERE id = ? AND domain_id = ?'
    ).bind(parseInt(recordId, 10), domainId).first<DnsRecord>();

    if (!record) {
      return errorResponse('DNS record not found', 404);
    }

    // Delete from database
    await env.DB.prepare('DELETE FROM dns_records WHERE id = ?')
      .bind(parseInt(recordId, 10)).run();

    return successResponse({ deleted: true });
  } catch (e) {
    console.error('Failed to delete DNS record:', e);
    return errorResponse('Failed to delete DNS record', 500);
  }
};
