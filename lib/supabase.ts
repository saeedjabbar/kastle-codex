import { createClient } from '@supabase/supabase-js';
import type { KastleVisitor } from '@/types';

// Lazy-initialized Supabase clients
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;
let supabaseClientInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Supabase URL not configured. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  }
  return url;
}

function getSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Supabase service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY');
  }
  return key;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Supabase anon key not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  }
  return key;
}

// Server-side client with service role key for admin operations
export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminInstance;
}

// Client-side client with anon key
export function getSupabaseClient(): ReturnType<typeof createClient> {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return supabaseClientInstance;
}

export async function createVisitorRecord(data: {
  name: string;
  email: string;
  date: string;
  event_name?: string;
}): Promise<KastleVisitor> {
  const { data: visitor, error } = await (getSupabaseAdmin() as any)
    .from('kastle')
    .insert({
      name: data.name,
      email: data.email,
      date: data.date,
      event_name: data.event_name,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create visitor record: ${error.message}`);
  }

  return visitor as KastleVisitor;
}

export async function getVisitorRecord(id: string): Promise<KastleVisitor | null> {
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('kastle')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch visitor record: ${error.message}`);
  }

  return data as KastleVisitor;
}

export async function updateVisitorStatus(
  id: string,
  status: 'pending' | 'approved' | 'failed'
): Promise<void> {
  const { error } = await (getSupabaseAdmin() as any)
    .from('kastle')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update visitor status: ${error.message}`);
  }
}

