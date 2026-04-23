import { NextRequest, NextResponse } from 'next/server';
import { verifyGHLSignature, parseGHLWebhook, isTargetCalendar } from '@/lib/ghl';
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signatureValid = verifyGHLSignature(rawBody, request.headers.get('x-ghl-signature'));
  if (!signatureValid) {
    console.error('GHL signature verification failed', {
      hasSecretConfigured: Boolean(process.env.GHL_WEBHOOK_SECRET),
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const payload = parseGHLWebhook(body);

    if (!isTargetCalendar(payload.calendarId)) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'wrong calendar' });
    }

    const status = payload.appointment.status;
    if (status !== 'booked' && status !== 'confirmed') {
      return NextResponse.json({ ok: true, ignored: true, reason: `unhandled status: ${status}` });
    }

    const name =
      payload.contact.firstName && payload.contact.lastName
        ? `${payload.contact.firstName} ${payload.contact.lastName}`
        : payload.contact.name ?? 'Unknown';
    const email = payload.contact.email;
    const date = payload.appointment.startTime;

    const existing = await findVisitorByEmailAndDate(email, date);
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const visitor = await createVisitorRecord({
      name,
      email,
      date,
      event_name: payload.appointment.title || 'Tour of Framework Williamsburg (GHL)',
    });

    const baseUrl = resolveBaseUrl(request);
    const approvalUrl = `${baseUrl}/api/approve?kastleid=${visitor.id}`;

    await sendApprovalEmail({
      visitorName: name,
      visitorEmail: email,
      visitDate: date,
      approvalUrl,
    });

    return NextResponse.json({ ok: true, created: true, visitorId: visitor.id });
  } catch (error) {
    console.error('GHL webhook failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
