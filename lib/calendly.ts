import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

const calendlyInviteeCreatedSchema = z.object({
  event: z.literal('invitee.created'),
  payload: z.object({
    name: z.string(),
    email: z.string().email(),
    scheduled_event: z.object({
      name: z.string(),
      start_time: z.string(),
      uri: z.string().url(),
    }),
  }),
});

export type CalendlyInviteeCreated = z.infer<typeof calendlyInviteeCreatedSchema>;

export function parseCalendlyInviteeCreated(body: unknown) {
  const parsed = calendlyInviteeCreatedSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error(`Unsupported Calendly payload: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function isFrameworkWilliamsburg(eventName: string) {
  const expected = process.env.CALENDLY_EVENT_NAME ?? 'Tour of Framework (Williamsburg)';
  return eventName.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function verifyCalendlySignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const fragments = signatureHeader.split(',');
  const timestampFragment = fragments.find((item) => item.startsWith('t='));
  const signatureFragment = fragments.find((item) => item.startsWith('v1='));

  if (!timestampFragment || !signatureFragment) {
    return false;
  }

  const timestamp = timestampFragment.replace('t=', '');
  const signature = signatureFragment.replace('v1=', '');

  const unsignedContent = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(unsignedContent).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
