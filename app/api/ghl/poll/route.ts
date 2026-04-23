import { NextRequest, NextResponse } from 'next/server';
import { fetchRecentAppointments, ghlRequest } from '@/lib/ghl';
import { createVisitorRecord, findVisitorByEmailAndDate } from '@/lib/supabase';
import { sendApprovalEmail } from '@/lib/email';

type GHLContact = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type GHLEvent = {
  id: string;
  calendarId: string;
  locationId?: string;
  contactId?: string;
  status: string;
  startTime: string;
  endTime: string;
  title?: string;
  contact?: GHLContact;
};

function resolveBaseUrl(request?: NextRequest) {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  if (request) {
    return new URL(request.url).origin.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

function buildContactName(contact: GHLContact): string {
  if (contact.firstName || contact.lastName) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }
  return contact.name || 'Unknown';
}

async function resolveContact(event: GHLEvent): Promise<GHLContact | null> {
  if (event.contact?.email) {
    return event.contact;
  }

  if (!event.contactId) {
    return null;
  }

  const params = new URLSearchParams();
  if (event.locationId) {
    params.set('locationId', event.locationId);
  }

  const data = await ghlRequest<{ contact: GHLContact }>(
    `/contacts/${event.contactId}`,
    params.toString() ? params : undefined
  );

  return data.contact ?? null;
}

async function processAppointment(event: GHLEvent, baseUrl: string) {
  if (event.status !== 'new' && event.status !== 'booked' && event.status !== 'confirmed') {
    return { created: 0, skipped: 1 };
  }

  const contact = await resolveContact(event);
  if (!contact?.email) {
    return { created: 0, skipped: 1 };
  }

  const name = buildContactName(contact);
  const email = contact.email;

  const existing = await findVisitorByEmailAndDate(email, event.startTime);
  if (existing) {
    return { created: 0, skipped: 1 };
  }

  const visitor = await createVisitorRecord({
    name,
    email,
    date: event.startTime,
    event_name: event.title || 'Tour of Framework Williamsburg (GHL)',
  });

  const approvalUrl = `${baseUrl}/api/approve?kastleid=${visitor.id}`;
  await sendApprovalEmail({
    visitorName: name,
    visitorEmail: email,
    visitDate: event.startTime,
    approvalUrl,
  });

  return { created: 1, skipped: 0 };
}

async function handler(request: NextRequest) {
  const lookbackHours = Number(process.env.GHL_POLL_LOOKBACK_HOURS ?? '48');
  const minStartTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const calendarId = process.env.GHL_CALENDAR_ID || 'ZS02f10licU0EtHBXA9S';
  const baseUrl = resolveBaseUrl(request);

  const data = await fetchRecentAppointments(calendarId, minStartTime, endTime);
  const events = (data.events || []) as GHLEvent[];

  let processed = 0;
  let created = 0;
  let skipped = 0;

  for (const event of events) {
    const result = await processAppointment(event, baseUrl);
    processed += 1;
    created += result.created;
    skipped += result.skipped;
  }

  return NextResponse.json({
    ok: true,
    summary: { processed, created, skipped },
  });
}

export async function GET(request: NextRequest) {
  try {
    return await handler(request);
  } catch (error) {
    console.error('GHL poll failed', error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
