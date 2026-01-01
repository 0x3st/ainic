// Logout endpoint - clears session cookie

import type { Env } from '../lib/types';
import { clearSessionCookie, getCookieName } from '../lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const cookieName = getCookieName(env);

  const headers = new Headers();
  headers.append('Set-Cookie', clearSessionCookie(cookieName));
  headers.set('Location', '/');

  return new Response(null, {
    status: 302,
    headers,
  });
};

export const onRequestPost: PagesFunction<Env> = onRequestGet;
