// OAuth2 Login endpoint - redirects to LinuxDO Connect

import type { Env } from '../lib/types';
import { generateState, generatePKCE } from '../lib/jwt';
import { setStateCookie, setPKCECookie } from '../lib/auth';

const LINUXDO_AUTHORIZE_URL = 'https://connect.linux.do/oauth2/authorize';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Generate state for CSRF protection
  const state = generateState();

  // Generate PKCE challenge (optional but recommended)
  const pkce = await generatePKCE();

  // Build authorization URL
  const authUrl = new URL(LINUXDO_AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', env.LINUXDO_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', getCallbackUrl(request));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', pkce.challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Set cookies and redirect
  const headers = new Headers();
  headers.append('Set-Cookie', setStateCookie(state));
  headers.append('Set-Cookie', setPKCECookie(pkce.verifier));
  headers.set('Location', authUrl.toString());

  return new Response(null, {
    status: 302,
    headers,
  });
};

function getCallbackUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/auth/callback`;
}
