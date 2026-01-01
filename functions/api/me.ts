// /api/me - Get current user info and quota

import type { Env, MeResponse, Domain } from '../lib/types';
import { requireAuth, successResponse, errorResponse } from '../lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Check if user has a domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  const response: MeResponse = {
    user: {
      linuxdo_id: linuxdoId,
      username: user.username,
      trust_level: user.trust_level,
    },
    quota: {
      maxDomains: 1,
      used: domain ? 1 : 0,
    },
  };

  return successResponse(response);
};
