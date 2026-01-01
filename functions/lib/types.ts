// Shared type definitions for py.kg NIC

export interface Env {
  DB: D1Database;
  LINUXDO_CLIENT_ID: string;
  LINUXDO_CLIENT_SECRET: string;
  JWT_SIGNING_KEY: string;
  DESEC_TOKEN: string;
  BASE_DOMAIN: string;
  SESSION_COOKIE_NAME?: string;
}

export interface LinuxDOUser {
  id: number;
  username: string;
  trust_level: number;
  silenced: boolean;
  suspended: boolean;
}

export interface JWTPayload {
  sub: string; // linuxdo_id as string
  username: string;
  trust_level: number;
  iat: number;
  exp: number;
}

export interface User {
  linuxdo_id: number;
  username: string;
  trust_level: number;
  silenced: number;
  suspended: number;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: number;
  label: string;
  fqdn: string;
  owner_linuxdo_id: number;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface AuditLog {
  id: number;
  linuxdo_id: number;
  action: string;
  target: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

// deSEC types
export interface DeSECRRSet {
  subname: string;
  type: string;
  ttl: number;
  records: string[];
}

export interface DeSECZone {
  name: string;
  minimum_ttl: number;
  keys?: Array<{
    dnskey: string;
    ds: string[];
    flags: number;
    keytype: string;
  }>;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MeResponse {
  user: {
    linuxdo_id: number;
    username: string;
    trust_level: number;
  };
  quota: {
    maxDomains: number;
    used: number;
  };
}

export interface DomainResponse {
  label: string;
  fqdn: string;
  status: string;
  created_at: string;
}
