// /api/dns-records/:id - Delete a DNS record

import type { Env, Domain, DnsRecord } from '../../lib/types';
import { requireAuth, successResponse, errorResponse } from '../../lib/auth';
import { CloudflareDNSClient } from '../../lib/cloudflare-dns';

// DELETE /api/dns-records/:id - Delete a DNS record
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  const recordId = params.id as string;
  if (!recordId) {
    return errorResponse('Missing record ID', 400);
  }

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ? AND status = ?'
  ).bind(linuxdoId, 'active').first<Domain>();

  if (!domain) {
    return errorResponse('You do not have a registered domain', 404);
  }

  // Get the DNS record
  const record = await env.DB.prepare(
    'SELECT * FROM dns_records WHERE id = ? AND domain_id = ?'
  ).bind(parseInt(recordId, 10), domain.id).first<DnsRecord>();

  if (!record) {
    return errorResponse('DNS record not found', 404);
  }

  // Delete from Cloudflare
  if (record.cloudflare_record_id) {
    const cfClient = new CloudflareDNSClient(env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ZONE_ID);
    const cfResult = await cfClient.deleteDNSRecord(record.cloudflare_record_id);

    if (!cfResult.success) {
      console.error('Cloudflare DNS delete error:', cfResult.error);
      // Continue anyway to delete from database
    }
  }

  // Delete from database
  try {
    await env.DB.prepare('DELETE FROM dns_records WHERE id = ?').bind(parseInt(recordId, 10)).run();

    // Check if any records remain
    const { results: remaining } = await env.DB.prepare(
      'SELECT * FROM dns_records WHERE domain_id = ?'
    ).bind(domain.id).all<DnsRecord>();

    // If no records remain, reset dns_mode
    if (!remaining || remaining.length === 0) {
      await env.DB.prepare('UPDATE domains SET dns_mode = NULL WHERE id = ?').bind(domain.id).run();
    }

    return successResponse({ deleted: true });
  } catch (e) {
    console.error('Database error:', e);
    return errorResponse('Failed to delete DNS record', 500);
  }
};
