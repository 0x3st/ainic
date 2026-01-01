// Type definitions for Cloudflare Pages Functions

interface Env {
  DB: D1Database;
  LINUXDO_CLIENT_ID: string;
  LINUXDO_CLIENT_SECRET: string;
  JWT_SIGNING_KEY: string;
  DESEC_TOKEN: string;
  BASE_DOMAIN: string;
  SESSION_COOKIE_NAME?: string;
}

type PagesFunction<E = Env> = import("@cloudflare/workers-types").PagesFunction<E>;
