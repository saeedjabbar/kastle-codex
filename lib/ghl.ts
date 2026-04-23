import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

const ghlContactSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
}).passthrough();

const ghlAppointmentSchema = z.object({
  id: z.string(),
  calendarId: z.string(),
  locationId: z.string(),
  contactId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  title: z.string().optional(),
  status: z.string(),
}).passthrough();

const ghlWebhookSchema = z.object({
  type: z.string(),
  locationId: z.string(),
  calendarId: z.string(),
  contactId: z.string().optional(),
  appointment: ghlAppointmentSchema,
  contact: ghlContactSchema,
}).passthrough();

export type GHLWebhookPayload = z.infer<typeof ghlWebhookSchema>;

export function parseGHLWebhook(body: unknown) {
  const parsed = ghlWebhookSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error(`Unsupported GHL payload: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function isTargetCalendar(calendarId: string) {
  const expected = process.env.GHL_CALENDAR_ID ?? 'ZS02f10licU0EtHBXA9S';
  return calendarId === expected;
}

export function verifyGHLSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.GHL_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

export async function ghlRequest<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const url = new URL(path, GHL_BASE_URL);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: '2021-04-15',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`GHL API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export function fetchRecentAppointments(calendarId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    calendarId,
    startTime: startDate,
    endTime: endDate,
  });

  return ghlRequest<{ events: unknown[] }>('/calendars/events', params);
}

type GHLAppointmentEvent = {
  id: string;
  calendarId: string;
  locationId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  title?: string;
  appointmentStatus: string;
};

export async function fetchContactAppointments(contactId: string): Promise<GHLAppointmentEvent[]> {
  const data = await ghlRequest<{ events: GHLAppointmentEvent[] }>(
    `/contacts/${contactId}/appointments`
  );
  return data.events ?? [];
}

const ghlWorkflowWebhookSchema = z.object({
  email: z.string().email(),
  contact_id: z.string().optional(),
  id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  full_name: z.string().optional(),
  location_id: z.string().optional(),
}).passthrough();

export function parseGHLWorkflowWebhook(body: unknown) {
  const parsed = ghlWorkflowWebhookSchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data;
}
