// Notification helper functions

import type { Notification } from './types';

export async function createNotification(
  db: D1Database,
  linuxdoId: number,
  type: Notification['type'],
  title: string,
  message: string
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO notifications (linuxdo_id, type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'))
    `).bind(linuxdoId, type, title, message).run();
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}

export async function getUnreadNotifications(
  db: D1Database,
  linuxdoId: number
): Promise<Notification[]> {
  try {
    const { results } = await db.prepare(`
      SELECT * FROM notifications
      WHERE linuxdo_id = ? AND is_read = 0
      ORDER BY created_at DESC
    `).bind(linuxdoId).all<Notification>();

    return results || [];
  } catch (e) {
    console.error('Failed to get unread notifications:', e);
    return [];
  }
}

export async function markNotificationAsRead(
  db: D1Database,
  id: number,
  linuxdoId: number
): Promise<boolean> {
  try {
    await db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE id = ? AND linuxdo_id = ?
    `).bind(id, linuxdoId).run();
    return true;
  } catch (e) {
    console.error('Failed to mark notification as read:', e);
    return false;
  }
}

export async function markAllNotificationsAsRead(
  db: D1Database,
  linuxdoId: number
): Promise<boolean> {
  try {
    await db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE linuxdo_id = ? AND is_read = 0
    `).bind(linuxdoId).run();
    return true;
  } catch (e) {
    console.error('Failed to mark all notifications as read:', e);
    return false;
  }
}
