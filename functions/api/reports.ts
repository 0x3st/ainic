// /api/reports - Domain abuse reporting

import type { Env } from '../lib/types';
import { requireAuth, successResponse, errorResponse } from '../lib/auth';

interface Report {
  id: number;
  label: string;
  reporter_linuxdo_id: number;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
}

// POST /api/reports - Submit abuse report
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Parse request body
  let body: { label?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { label, reason } = body;

  if (!label || !reason) {
    return errorResponse('Missing label or reason', 400);
  }

  const trimmedLabel = label.trim().toLowerCase();
  const trimmedReason = reason.trim();

  if (trimmedReason.length < 5) {
    return errorResponse('Reason must be at least 5 characters', 400);
  }

  try {
    // Check if domain exists
    const domain = await env.DB.prepare(
      'SELECT id FROM domains WHERE label = ? AND status = ?'
    ).bind(trimmedLabel, 'active').first();

    if (!domain) {
      return errorResponse('Domain not found', 404);
    }

    // Insert report
    await env.DB.prepare(`
      INSERT INTO reports (label, reporter_linuxdo_id, reason, status, created_at)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `).bind(trimmedLabel, linuxdoId, trimmedReason).run();

    return successResponse({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Report submission error:', error);
    return errorResponse('Failed to submit report', 500);
  }
};
