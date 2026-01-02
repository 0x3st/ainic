// /api/blacklist - Public blacklist of banned users

import type { Env } from '../lib/types';
import { successResponse, errorResponse } from '../lib/auth';

interface BlacklistUser {
  username: string;
  ban_reason: string | null;
  updated_at: string;
}

// GET /api/blacklist - Get all banned users
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const { results: bannedUsers } = await env.DB.prepare(`
      SELECT username, ban_reason, updated_at
      FROM users
      WHERE is_banned = 1
      ORDER BY updated_at DESC
    `).all<BlacklistUser>();

    return successResponse({ users: bannedUsers || [] });
  } catch (error) {
    console.error('Blacklist query error:', error);
    return errorResponse('Failed to load blacklist', 500);
  }
};
