import { createClient } from '@supabase/supabase-js';
import type { KastleVisitor } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client-side client with anon key
export const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!
);

export async function createVisitorRecord(data: {
  name: string;
  email: string;
  date: string;
  event_name?: string;
}): Promise<KastleVisitor> {
  const { data: visitor, error } = await supabaseAdmin
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

  return visitor;
}

export async function getVisitorRecord(id: string): Promise<KastleVisitor | null> {
  const { data, error } = await supabaseAdmin
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

  return data;
}

export async function updateVisitorStatus(
  id: string,
  status: 'pending' | 'approved' | 'failed'
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('kastle')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update visitor status: ${error.message}`);
  }
}

