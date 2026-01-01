// /api/domains - Domain registration and management

import type { Env, Domain, DomainResponse } from '../lib/types';
import { requireAuth, successResponse, errorResponse } from '../lib/auth';
import { validateLabel } from '../lib/validators';
import { DeSECClient, createSubdomainWithDelegation, deleteSubdomainWithDelegation } from '../lib/desec';

// GET /api/domains - Get user's domain
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (!domain) {
    return successResponse({ domain: null });
  }

  const response: DomainResponse = {
    label: domain.label,
    fqdn: domain.fqdn,
    status: domain.status,
    created_at: domain.created_at,
  };

  return successResponse({ domain: response });
};

// POST /api/domains - Register a new domain
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Parse request body
  let body: { label?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { label } = body;
  if (!label || typeof label !== 'string') {
    return errorResponse('Missing or invalid label', 400);
  }

  // Normalize label to lowercase
  const normalizedLabel = label.toLowerCase().trim();

  // Validate label
  const validation = validateLabel(normalizedLabel);
  if (!validation.valid) {
    return errorResponse(validation.error!, 400);
  }

  // Check if user already has a domain
  const existingDomain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (existingDomain) {
    return errorResponse('You already have a registered domain. Each user can only register one domain.', 409);
  }

  // Check if label is already taken
  const labelTaken = await env.DB.prepare(
    'SELECT * FROM domains WHERE label = ?'
  ).bind(normalizedLabel).first<Domain>();

  if (labelTaken) {
    return errorResponse('This domain label is already registered', 409);
  }

  // Create subdomain in deSEC
  const desec = new DeSECClient(env.DESEC_TOKEN);
  const baseDomain = env.BASE_DOMAIN || 'py.kg';

  const createResult = await createSubdomainWithDelegation(desec, baseDomain, normalizedLabel);
  if (!createResult.success) {
    console.error('deSEC error:', createResult.error);
    return errorResponse(`Failed to create domain: ${createResult.error}`, 500);
  }

  // Insert domain into database
  try {
    await env.DB.prepare(`
      INSERT INTO domains (label, fqdn, owner_linuxdo_id, status, created_at)
      VALUES (?, ?, ?, 'active', datetime('now'))
    `).bind(normalizedLabel, createResult.fqdn, linuxdoId).run();

    // Log the action
    await logAudit(env.DB, linuxdoId, 'domain_register', createResult.fqdn, {
      label: normalizedLabel,
      ns: createResult.ns,
    }, getClientIP(request));

  } catch (e) {
    // Rollback: delete the zone we just created
    console.error('Database error:', e);
    await deleteSubdomainWithDelegation(desec, baseDomain, normalizedLabel);
    return errorResponse('Failed to save domain to database', 500);
  }

  const response: DomainResponse = {
    label: normalizedLabel,
    fqdn: createResult.fqdn,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  return successResponse({ domain: response });
};

// DELETE /api/domains - Delete user's domain
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (!domain) {
    return errorResponse('You do not have a registered domain', 404);
  }

  // Delete from deSEC
  const desec = new DeSECClient(env.DESEC_TOKEN);
  const baseDomain = env.BASE_DOMAIN || 'py.kg';

  const deleteResult = await deleteSubdomainWithDelegation(desec, baseDomain, domain.label);
  if (!deleteResult.success) {
    console.error('deSEC delete error:', deleteResult.error);
    return errorResponse(`Failed to delete domain: ${deleteResult.error}`, 500);
  }

  // Delete from database
  try {
    await env.DB.prepare(
      'DELETE FROM domains WHERE owner_linuxdo_id = ?'
    ).bind(linuxdoId).run();

    // Log the action
    await logAudit(env.DB, linuxdoId, 'domain_delete', domain.fqdn, {
      label: domain.label,
    }, getClientIP(request));

  } catch (e) {
    console.error('Database error:', e);
    return errorResponse('Failed to delete domain from database', 500);
  }

  return successResponse({ deleted: true });
};

// Helper to log audit events
async function logAudit(
  db: D1Database,
  linuxdoId: number,
  action: string,
  target: string,
  details: Record<string, unknown>,
  ipAddress: string | null
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (linuxdo_id, action, target, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      linuxdoId,
      action,
      target,
      JSON.stringify(details),
      ipAddress
    ).run();
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}

// Helper to get client IP
function getClientIP(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         null;
}
