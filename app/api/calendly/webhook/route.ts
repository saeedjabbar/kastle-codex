import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  isFrameworkWilliamsburg,
  parseCalendlyInviteeCreated,
  verifyCalendlySignature,
} from '@/lib/calendly';
import { createVisitorRecord } from '@/lib/supabase';
import { sendApprovalEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const signatureHeader = request.headers.get('Calendly-Webhook-Signature');

  if (!verifyCalendlySignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Failed to parse Calendly payload', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const parsed = parseCalendlyInviteeCreated(payload);

    if (!isFrameworkWilliamsburg(parsed.payload.scheduled_event.name)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const visitor = await createVisitorRecord({
      name: parsed.payload.name,
      email: parsed.payload.email,
      date: parsed.payload.scheduled_event.start_time,
      event_name: parsed.payload.scheduled_event.name,
    });

    const host = process.env.APP_BASE_URL ?? new URL(request.url).origin;
    const approvalUrl = `${host.replace(/\/$/, '')}/api/approve?kastleid=${visitor.id}`;

    await sendApprovalEmail({
      visitorName: parsed.payload.name,
      visitorEmail: parsed.payload.email,
      visitDate: parsed.payload.scheduled_event.start_time,
      approvalUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Calendly webhook failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
