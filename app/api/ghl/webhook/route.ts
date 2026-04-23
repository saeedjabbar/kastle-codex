import { NextRequest, NextResponse } from 'next/server';
import {
  verifyGHLSignature,
  parseGHLWebhook,
  parseGHLWorkflowWebhook,
  isTargetCalendar,
  fetchContactAppointments,
} from '@/lib/ghl';
import { createVisitorRecord, findVisitorByEmailAndDate } from '@/lib/supabase';
import { sendApprovalEmail } from '@/lib/email';

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

const VALID_STATUSES = new Set(['new', 'booked', 'confirmed']);

async function handleNestedPayload(body: unknown, request: NextRequest) {
  const payload = parseGHLWebhook(body);

  if (!isTargetCalendar(payload.calendarId)) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'wrong calendar' });
  }

  if (!VALID_STATUSES.has(payload.appointment.status)) {
    return NextResponse.json({ ok: true, ignored: true, reason: `unhandled status: ${payload.appointment.status}` });
  }

  const name =
    payload.contact.firstName && payload.contact.lastName
      ? `${payload.contact.firstName} ${payload.contact.lastName}`
      : payload.contact.name ?? 'Unknown';
  const email = payload.contact.email;
  const date = payload.appointment.startTime;

  return processVisitor({ name, email, date, title: payload.appointment.title, request });
}

async function handleWorkflowPayload(body: unknown, request: NextRequest) {
  const flat = parseGHLWorkflowWebhook(body);
  if (!flat) return null;

  const contactId = flat.contact_id || flat.id;
  if (!contactId) {
    console.error('GHL workflow webhook: no contact_id found', flat);
    return null;
  }

  const name = flat.full_name
    || [flat.first_name, flat.last_name].filter(Boolean).join(' ')
    || 'Unknown';
  const email = flat.email;

  const appointments = await fetchContactAppointments(contactId);
  const targetCalendarId = process.env.GHL_CALENDAR_ID ?? 'ZS02f10licU0EtHBXA9S';
  const match = appointments.find(
    (a) => a.calendarId === targetCalendarId && VALID_STATUSES.has(a.appointmentStatus)
  );

  if (!match) {
    console.log('GHL workflow webhook: no matching appointment found for contact', contactId);
    return NextResponse.json({ ok: true, ignored: true, reason: 'no matching appointment' });
  }

  return processVisitor({ name, email, date: match.startTime, title: match.title, request });
}

async function processVisitor(opts: {
  name: string;
  email: string;
  date: string;
  title?: string;
  request: NextRequest;
}) {
  const existing = await findVisitorByEmailAndDate(opts.email, opts.date);
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const visitor = await createVisitorRecord({
    name: opts.name,
    email: opts.email,
    date: opts.date,
    event_name: opts.title || 'Tour of Framework Williamsburg (GHL)',
  });

  const baseUrl = resolveBaseUrl(opts.request);
  const approvalUrl = `${baseUrl}/api/approve?kastleid=${visitor.id}`;

  await sendApprovalEmail({
    visitorName: opts.name,
    visitorEmail: opts.email,
    visitDate: opts.date,
    approvalUrl,
  });

  return NextResponse.json({ ok: true, created: true, visitorId: visitor.id });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signatureValid = verifyGHLSignature(rawBody, request.headers.get('x-ghl-signature'));
  if (!signatureValid) {
    console.error('GHL signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  console.log('GHL webhook received:', JSON.stringify(body).substring(0, 500));

  try {
    return await handleNestedPayload(body, request);
  } catch {
    // Nested format failed — try flat GHL Workflow format
  }

  try {
    const result = await handleWorkflowPayload(body, request);
    if (result) return result;
  } catch (error) {
    console.error('GHL workflow webhook failed', error);
  }

  console.error('GHL webhook: unrecognized payload format', JSON.stringify(body).substring(0, 300));
  return NextResponse.json({ error: 'Unrecognized payload format' }, { status: 400 });
}
