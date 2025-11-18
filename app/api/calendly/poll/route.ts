import { NextRequest, NextResponse } from 'next/server';
import { isFrameworkWilliamsburg } from '@/lib/calendly';
import { createVisitorRecord, findVisitorByEmailAndDate } from '@/lib/supabase';
import { sendApprovalEmail } from '@/lib/email';

type CalendlyScheduledEvent = {
  uri: string;
  name: string;
  start_time: string;
  end_time: string;
  event_memberships: Array<{
    user: string;
    user_email: string;
  }>;
};

type CalendlyInvitee = {
  uri: string;
  name: string;
  email: string;
  status: string;
};

const CALENDLY_API_BASE = 'https://api.calendly.com';

function getCalendlyApiToken() {
  const token = process.env.CALENDLY_API_TOKEN || process.env.CALENDLY_PAT;
  if (!token) {
    throw new Error('CALENDLY_API_TOKEN is not configured');
  }
  return token;
}

function getCalendlyOrganization() {
  const organization =
    process.env.CALENDLY_ORGANIZATION_URI || process.env.CALENDLY_ORGANIZATION;
  if (!organization) {
    throw new Error('CALENDLY_ORGANIZATION_URI is not configured');
  }
  return organization;
}

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

async function calendlyRequest<T>(path: string, searchParams?: URLSearchParams) {
  const token = getCalendlyApiToken();
  const url = new URL(`${CALENDLY_API_BASE}${path}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Calendly API ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function fetchRecentEvents(minStartISO: string) {
  const params = new URLSearchParams({
    organization: getCalendlyOrganization(),
    status: 'active',
    count: '20',
    sort: 'start_time:desc',
    min_start_time: minStartISO,
  });

  const data = await calendlyRequest<{ collection: CalendlyScheduledEvent[] }>(
    '/scheduled_events',
    params
  );

  return data.collection;
}

async function fetchInvitees(eventUri: string) {
  const eventId = eventUri.split('/').pop();
  if (!eventId) {
    return [];
  }
  const data = await calendlyRequest<{ collection: CalendlyInvitee[] }>(
    `/scheduled_events/${eventId}/invitees`
  );
  return data.collection;
}

async function processEvent(event: CalendlyScheduledEvent, baseUrl: string) {
  if (!isFrameworkWilliamsburg(event.name)) {
    return { created: 0, skipped: 1 };
  }

  const invitees = await fetchInvitees(event.uri);
  let created = 0;
  let skipped = 0;

  for (const invitee of invitees) {
    if (invitee.status !== 'active') {
      skipped += 1;
      continue;
    }

    const existing = await findVisitorByEmailAndDate(invitee.email, event.start_time);
    if (existing) {
      skipped += 1;
      continue;
    }

    const visitor = await createVisitorRecord({
      name: invitee.name,
      email: invitee.email,
      date: event.start_time,
      event_name: event.name,
    });

    const approvalUrl = `${baseUrl}/api/approve?kastleid=${visitor.id}`;
    await sendApprovalEmail({
      visitorName: invitee.name,
      visitorEmail: invitee.email,
      visitDate: event.start_time,
      approvalUrl,
    });

    created += 1;
  }

  return { created, skipped };
}

async function handler(request: NextRequest) {
  const lookbackHours = Number(process.env.CALENDLY_POLL_LOOKBACK_HOURS ?? '48');
  const minStartTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const baseUrl = resolveBaseUrl(request);

  const events = await fetchRecentEvents(minStartTime);

  let processed = 0;
  let created = 0;
  let skipped = 0;

  for (const event of events) {
    const result = await processEvent(event, baseUrl);
    processed += 1;
    created += result.created;
    skipped += result.skipped;
  }

  return NextResponse.json({
    ok: true,
    summary: { processed, created, skipped },
  });
}

if (process.env.NODE_ENV !== 'production') {
  export async function GET(request: NextRequest) {
    try {
      return await handler(request);
    } catch (error) {
      console.error('Calendly poll failed', error);
      return NextResponse.json(
        { ok: false, error: (error as Error).message },
        { status: 500 }
      );
    }
  }

  export async function POST(request: NextRequest) {
    return GET(request);
  }
}

