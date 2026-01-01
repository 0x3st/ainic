// /api/admin/promote - Promote user to admin using secret

import type { Env, User } from '../../lib/types';
import { requireAuth, successResponse, errorResponse } from '../../lib/auth';

// Shared promotion logic
async function promoteUser(request: Request, env: Env, secret: string) {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  // Check if ADMIN_SECRET is configured
  if (!env.ADMIN_SECRET) {
    return errorResponse('Admin promotion is not configured', 403);
  }

  if (!secret || typeof secret !== 'string') {
    return errorResponse('Missing secret', 400);
  }

  // Verify secret using constant-time comparison
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  const expectedBytes = encoder.encode(env.ADMIN_SECRET);

  if (secretBytes.length !== expectedBytes.length) {
    return errorResponse('Invalid secret', 403);
  }

  let match = true;
  for (let i = 0; i < secretBytes.length; i++) {
    if (secretBytes[i] !== expectedBytes[i]) {
      match = false;
    }
  }

  if (!match) {
    return errorResponse('Invalid secret', 403);
  }

  const linuxdoId = parseInt(authResult.user.sub, 10);

  try {
    console.log('[Promote] Starting promotion for user:', linuxdoId);

    // Check if user exists
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE linuxdo_id = ?'
    ).bind(linuxdoId).first<User>();

    console.log('[Promote] User found:', user ? 'yes' : 'no', user ? `is_admin=${user.is_admin}` : '');

    if (!user) {
      return errorResponse('User not found', 404);
    }

    if (user.is_admin === 1) {
      return successResponse({ message: 'Already an admin' });
    }

    // Promote to admin
    console.log('[Promote] Updating user to admin...');
    const updateResult = await env.DB.prepare(`
      UPDATE users SET is_admin = 1, updated_at = datetime('now')
      WHERE linuxdo_id = ?
    `).bind(linuxdoId).run();

    console.log('[Promote] Update result:', updateResult);

    // Log the action
    console.log('[Promote] Inserting audit log...');
    const auditResult = await env.DB.prepare(`
      INSERT INTO audit_logs (linuxdo_id, action, target, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      linuxdoId,
      'admin_promote_self',
      linuxdoId.toString(),
      JSON.stringify({ method: 'secret' }),
      request.headers.get('CF-Connecting-IP')
    ).run();

    console.log('[Promote] Audit log result:', auditResult);
    console.log('[Promote] Success!');

    return successResponse({ message: 'Successfully promoted to admin' });
  } catch (e) {
    console.error('[Promote] Error:', e);
    console.error('[Promote] Error stack:', e instanceof Error ? e.stack : 'No stack trace');
    console.error('[Promote] Error message:', e instanceof Error ? e.message : String(e));
    return errorResponse(`Failed to promote user: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
}

// GET /api/admin/promote?secret=xxx - Promote via URL parameter
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || '';

  return promoteUser(request, env, secret);
};

// POST /api/admin/promote - Promote via JSON body
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { secret?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { secret = '' } = body;

  return promoteUser(request, env, secret);
};
