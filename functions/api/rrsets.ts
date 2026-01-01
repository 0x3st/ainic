// /api/rrsets - DNS record management

import type { Env, Domain, DeSECRRSet } from '../lib/types';
import { requireAuth, successResponse, errorResponse } from '../lib/auth';
import { DeSECClient } from '../lib/desec';
import {
  validateRecordType,
  validateRecordValue,
  validateTTL,
  validateSubname,
  validateRRSetsForConflicts,
  ALLOWED_RECORD_TYPES,
  AllowedRecordType,
  RRSetInput,
} from '../lib/validators';

// GET /api/rrsets - Get all DNS records for user's domain
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (!domain) {
    return errorResponse('You do not have a registered domain', 404);
  }

  if (domain.status !== 'active') {
    return errorResponse('Your domain is suspended', 403);
  }

  // Fetch records from deSEC
  const desec = new DeSECClient(env.DESEC_TOKEN);
  const result = await desec.getRRSets(domain.fqdn);

  if (!result.success) {
    console.error('deSEC error:', result.error);
    return errorResponse(`Failed to fetch DNS records: ${result.error}`, 500);
  }

  // Filter to only show allowed record types and exclude system records
  const userRecords = result.data.filter((rrset) => {
    // Only show allowed types
    if (!ALLOWED_RECORD_TYPES.includes(rrset.type as AllowedRecordType)) {
      return false;
    }
    return true;
  });

  return successResponse({
    domain: domain.fqdn,
    rrsets: userRecords,
  });
};

// PUT /api/rrsets - Update DNS records (idempotent bulk update)
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (!domain) {
    return errorResponse('You do not have a registered domain', 404);
  }

  if (domain.status !== 'active') {
    return errorResponse('Your domain is suspended', 403);
  }

  // Parse request body
  let body: { rrsets?: RRSetInput[] };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { rrsets } = body;
  if (!rrsets || !Array.isArray(rrsets)) {
    return errorResponse('Missing or invalid rrsets array', 400);
  }

  // Validate all rrsets
  const validationErrors: string[] = [];

  for (let i = 0; i < rrsets.length; i++) {
    const rrset = rrsets[i];
    const prefix = `rrsets[${i}]`;

    // Validate subname
    const subnameValidation = validateSubname(rrset.subname || '');
    if (!subnameValidation.valid) {
      validationErrors.push(`${prefix}.subname: ${subnameValidation.error}`);
      continue;
    }

    // Validate type
    if (!validateRecordType(rrset.type)) {
      validationErrors.push(
        `${prefix}.type: Invalid or disallowed record type "${rrset.type}". Allowed types: ${ALLOWED_RECORD_TYPES.join(', ')}`
      );
      continue;
    }

    // Validate TTL
    const ttlValidation = validateTTL(rrset.ttl);
    if (!ttlValidation.valid) {
      validationErrors.push(`${prefix}.ttl: ${ttlValidation.error}`);
    }

    // Validate records array
    if (!Array.isArray(rrset.records)) {
      validationErrors.push(`${prefix}.records: Must be an array`);
      continue;
    }

    // Validate each record value
    for (let j = 0; j < rrset.records.length; j++) {
      const record = rrset.records[j];
      if (typeof record !== 'string') {
        validationErrors.push(`${prefix}.records[${j}]: Must be a string`);
        continue;
      }

      const valueValidation = validateRecordValue(rrset.type as AllowedRecordType, record);
      if (!valueValidation.valid) {
        validationErrors.push(`${prefix}.records[${j}]: ${valueValidation.error}`);
      }
    }
  }

  // Check for CNAME conflicts
  const conflictValidation = validateRRSetsForConflicts(rrsets);
  if (!conflictValidation.valid) {
    validationErrors.push(conflictValidation.error!);
  }

  if (validationErrors.length > 0) {
    return errorResponse(`Validation errors:\n${validationErrors.join('\n')}`, 400);
  }

  // Prepare rrsets for deSEC (normalize subname)
  const desecRRSets: DeSECRRSet[] = rrsets.map((rrset) => ({
    subname: rrset.subname || '',
    type: rrset.type,
    ttl: rrset.ttl,
    records: rrset.records,
  }));

  // Update records in deSEC
  const desec = new DeSECClient(env.DESEC_TOKEN);

  // Get existing records to determine what to delete
  const existingResult = await desec.getRRSets(domain.fqdn);
  if (!existingResult.success) {
    return errorResponse(`Failed to fetch existing records: ${existingResult.error}`, 500);
  }

  // Find records to delete (existing user-managed records not in new set)
  const newRecordKeys = new Set(
    desecRRSets.map((r) => `${r.subname}:${r.type}`)
  );

  const recordsToDelete: DeSECRRSet[] = existingResult.data
    .filter((r) => {
      // Only consider user-manageable types
      if (!ALLOWED_RECORD_TYPES.includes(r.type as AllowedRecordType)) {
        return false;
      }
      // Delete if not in new set
      return !newRecordKeys.has(`${r.subname}:${r.type}`);
    })
    .map((r) => ({
      subname: r.subname,
      type: r.type,
      ttl: r.ttl,
      records: [], // Empty records = delete
    }));

  // Combine updates and deletes
  const allUpdates = [...desecRRSets, ...recordsToDelete];

  if (allUpdates.length === 0) {
    return successResponse({
      domain: domain.fqdn,
      rrsets: [],
      message: 'No changes to apply',
    });
  }

  // Bulk update
  const updateResult = await desec.bulkUpdateRRSets(domain.fqdn, allUpdates);
  if (!updateResult.success) {
    console.error('deSEC update error:', updateResult.error);
    return errorResponse(`Failed to update DNS records: ${updateResult.error}`, 500);
  }

  // Log the action
  await logAudit(env.DB, linuxdoId, 'rrsets_update', domain.fqdn, {
    updated: desecRRSets.length,
    deleted: recordsToDelete.length,
  }, getClientIP(request));

  // Filter response to only show user records
  const userRecords = updateResult.data.filter((rrset) =>
    ALLOWED_RECORD_TYPES.includes(rrset.type as AllowedRecordType)
  );

  return successResponse({
    domain: domain.fqdn,
    rrsets: userRecords,
  });
};

// PATCH /api/rrsets - Update a single rrset
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (!domain) {
    return errorResponse('You do not have a registered domain', 404);
  }

  if (domain.status !== 'active') {
    return errorResponse('Your domain is suspended', 403);
  }

  // Parse request body
  let body: RRSetInput;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { subname, type, ttl, records } = body;

  // Validate
  const subnameValidation = validateSubname(subname || '');
  if (!subnameValidation.valid) {
    return errorResponse(`subname: ${subnameValidation.error}`, 400);
  }

  if (!validateRecordType(type)) {
    return errorResponse(
      `type: Invalid or disallowed record type "${type}". Allowed types: ${ALLOWED_RECORD_TYPES.join(', ')}`,
      400
    );
  }

  const ttlValidation = validateTTL(ttl);
  if (!ttlValidation.valid) {
    return errorResponse(`ttl: ${ttlValidation.error}`, 400);
  }

  if (!Array.isArray(records)) {
    return errorResponse('records: Must be an array', 400);
  }

  for (const record of records) {
    const valueValidation = validateRecordValue(type as AllowedRecordType, record);
    if (!valueValidation.valid) {
      return errorResponse(`records: ${valueValidation.error}`, 400);
    }
  }

  // Check for CNAME conflicts with existing records
  const desec = new DeSECClient(env.DESEC_TOKEN);
  const existingResult = await desec.getRRSets(domain.fqdn);
  if (!existingResult.success) {
    return errorResponse(`Failed to fetch existing records: ${existingResult.error}`, 500);
  }

  const normalizedSubname = subname || '';
  const existingAtSubname = existingResult.data.filter(
    (r) => r.subname === normalizedSubname && r.type !== type
  );

  if (type === 'CNAME' && existingAtSubname.length > 0) {
    return errorResponse(
      `Cannot add CNAME at "${normalizedSubname || '@'}" - other record types already exist there`,
      400
    );
  }

  if (type !== 'CNAME' && existingAtSubname.some((r) => r.type === 'CNAME')) {
    return errorResponse(
      `Cannot add ${type} at "${normalizedSubname || '@'}" - CNAME record already exists there`,
      400
    );
  }

  // Update the record
  const rrset: DeSECRRSet = {
    subname: normalizedSubname,
    type,
    ttl,
    records,
  };

  const updateResult = await desec.putRRSet(domain.fqdn, rrset);
  if (!updateResult.success) {
    console.error('deSEC update error:', updateResult.error);
    return errorResponse(`Failed to update DNS record: ${updateResult.error}`, 500);
  }

  // Log the action
  await logAudit(env.DB, linuxdoId, 'rrset_update', domain.fqdn, {
    subname: normalizedSubname,
    type,
    records_count: records.length,
  }, getClientIP(request));

  return successResponse({
    domain: domain.fqdn,
    rrset: updateResult.data,
  });
};

// DELETE /api/rrsets - Delete a specific rrset
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Authenticate
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const linuxdoId = parseInt(user.sub, 10);

  // Get user's domain
  const domain = await env.DB.prepare(
    'SELECT * FROM domains WHERE owner_linuxdo_id = ?'
  ).bind(linuxdoId).first<Domain>();

  if (!domain) {
    return errorResponse('You do not have a registered domain', 404);
  }

  if (domain.status !== 'active') {
    return errorResponse('Your domain is suspended', 403);
  }

  // Get subname and type from query params
  const url = new URL(request.url);
  const subname = url.searchParams.get('subname') ?? '';
  const type = url.searchParams.get('type');

  if (!type) {
    return errorResponse('Missing type parameter', 400);
  }

  if (!validateRecordType(type)) {
    return errorResponse(
      `Invalid or disallowed record type "${type}". Allowed types: ${ALLOWED_RECORD_TYPES.join(', ')}`,
      400
    );
  }

  // Delete the record
  const desec = new DeSECClient(env.DESEC_TOKEN);
  const deleteResult = await desec.deleteRRSet(domain.fqdn, subname, type);

  if (!deleteResult.success && deleteResult.status !== 404) {
    console.error('deSEC delete error:', deleteResult.error);
    return errorResponse(`Failed to delete DNS record: ${deleteResult.error}`, 500);
  }

  // Log the action
  await logAudit(env.DB, linuxdoId, 'rrset_delete', domain.fqdn, {
    subname,
    type,
  }, getClientIP(request));

  return successResponse({ deleted: true });
};

// Helper to log audit events
async function logAudit(
  db: D1Database,
  linuxdoId: number,
  action: string,
  target: string,
  details: Record<string, unknown>,
  ipAddress: string | null
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (linuxdo_id, action, target, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      linuxdoId,
      action,
      target,
      JSON.stringify(details),
      ipAddress
    ).run();
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}

// Helper to get client IP
function getClientIP(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         null;
}
