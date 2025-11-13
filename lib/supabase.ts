import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type VisitorStatus = 'pending' | 'processing' | 'authorized' | 'failed';

export interface VisitorRecord {
  id: string;
  name: string;
  email: string;
  date: string;
  approval_token: string;
  status: VisitorStatus;
  approval_clicked_at: string | null;
  authorized_at: string | null;
  failure_reason: string | null;
  calendly_payload: Record<string, unknown> | null;
}

let cachedClient: SupabaseClient<unknown, 'public', Record<string, never>> | null =
  null;

const tableName = process.env.SUPABASE_VISITOR_TABLE ?? 'kastle';

function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to your environment.',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseAdmin() {
  if (!cachedClient) {
    cachedClient = createAdminClient();
  }

  return cachedClient;
}

export async function insertVisitor(payload: {
  name: string;
  email: string;
  scheduled_for: string;
  approval_token: string;
  calendly_payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(tableName)
    .insert({
      name: payload.name,
      email: payload.email,
      date: payload.scheduled_for,
      approval_token: payload.approval_token,
      status: 'pending',
      calendly_payload: payload.calendly_payload,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as VisitorRecord;
}

export async function getVisitorByToken(token: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('approval_token', token)
    .single();

  if (error) {
    throw error;
  }

  return data as VisitorRecord;
}

export async function markVisitorProcessing(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(tableName)
    .update({
      status: 'processing',
      approval_clicked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as VisitorRecord;
}

export async function markVisitorAuthorized(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(tableName)
    .update({
      status: 'authorized',
      authorized_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as VisitorRecord;
}

export async function markVisitorFailed(id: string, reason: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(tableName)
    .update({
      status: 'failed',
      failure_reason: reason.slice(0, 1024),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as VisitorRecord;
}
