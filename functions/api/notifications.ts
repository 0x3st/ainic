// /api/notifications - User notifications

import type { Env, Notification } from '../lib/types';
import { requireAuth, successResponse, errorResponse } from '../lib/auth';
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../lib/notifications';

// GET /api/notifications - Get user's notifications
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread_only') === 'true';

  try {
    let notifications: Notification[];

    if (unreadOnly) {
      notifications = await getUnreadNotifications(env.DB, linuxdoId);
    } else {
      const { results } = await env.DB.prepare(`
        SELECT * FROM notifications
        WHERE linuxdo_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).bind(linuxdoId).all<Notification>();

      notifications = results || [];
    }

    return successResponse({ notifications });
  } catch (e) {
    console.error('Failed to get notifications:', e);
    return errorResponse('Failed to get notifications', 500);
  }
};

// POST /api/notifications - Mark notification(s) as read
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  let body: { id?: number; mark_all?: boolean };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  try {
    if (body.mark_all) {
      await markAllNotificationsAsRead(env.DB, linuxdoId);
      return successResponse({ marked: 'all' });
    } else if (body.id) {
      await markNotificationAsRead(env.DB, body.id, linuxdoId);
      return successResponse({ marked: body.id });
    } else {
      return errorResponse('Missing id or mark_all parameter', 400);
    }
  } catch (e) {
    console.error('Failed to mark notifications as read:', e);
    return errorResponse('Failed to mark notifications as read', 500);
  }
};
