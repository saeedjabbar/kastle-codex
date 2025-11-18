import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CalendlyScheduledEvent = {
  uri: string;
  name: string;
  start_time: string;
  event_memberships: Array<{ user: string; user_email: string }>;
};

type CalendlyInvitee = {
  uri: string;
  name: string;
  email: string;
  status: string;
};

const CALENDLY_API_BASE = "https://api.calendly.com";

const config = {
  calendlyToken: Deno.env.get("CALENDLY_API_TOKEN") ?? Deno.env.get("CALENDLY_PAT"),
  organization: Deno.env.get("CALENDLY_ORGANIZATION_URI") ?? Deno.env.get("CALENDLY_ORGANIZATION"),
  eventName: Deno.env.get("CALENDLY_EVENT_NAME") ?? "Tour of Framework (Williamsburg)",
  lookbackHours: Number(Deno.env.get("CALENDLY_POLL_LOOKBACK_HOURS") ?? "48"),
  appBaseUrl: (Deno.env.get("APP_BASE_URL") ?? "https://kastle-codex.vercel.app").replace(/\/$/, ""),
  resendApiKey: Deno.env.get("RESEND_API_KEY"),
  resendFrom: Deno.env.get("RESEND_FROM_EMAIL") ?? "RubixOne <notifications@example.com>",
  danEmail: Deno.env.get("DAN_NOTIFICATION_EMAIL") ?? "dan@framework.nyc",
  opsCc: Deno.env.get("OPS_CC_EMAIL") ?? "saeed@incl.us",
  supabaseUrl:
    Deno.env.get("CUSTOM_SUPABASE_URL") ??
    Deno.env.get("SUPABASE_URL") ??
    "https://mhickudgeeczbovsuudm.supabase.co",
  supabaseServiceKey:
    Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

if (!config.calendlyToken) throw new Error("CALENDLY_API_TOKEN is not configured");
if (!config.organization) throw new Error("CALENDLY_ORGANIZATION_URI is not configured");
if (!config.supabaseUrl) throw new Error("CUSTOM_SUPABASE_URL or SUPABASE_URL is not configured");
if (!config.supabaseServiceKey) throw new Error("SERVICE_ROLE_KEY is not configured");
if (!config.resendApiKey) throw new Error("RESEND_API_KEY is not configured");

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isFrameworkWilliamsburg(name: string) {
  return name.trim().toLowerCase() === config.eventName.trim().toLowerCase();
}

async function calendlyRequest<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const url = new URL(`${CALENDLY_API_BASE}${path}`);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.calendlyToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Calendly API ${response.status}: ${text}`);
  }
  return await response.json();
}

async function fetchRecentEvents(minStartISO: string) {
  const params = new URLSearchParams({
    organization: config.organization!,
    status: "active",
    count: "20",
    sort: "start_time:desc",
    min_start_time: minStartISO,
  });
  const data = await calendlyRequest<{ collection: CalendlyScheduledEvent[] }>(
    "/scheduled_events",
    params,
  );
  return data.collection;
}

async function fetchInvitees(eventUri: string) {
  const eventId = eventUri.split("/").pop();
  if (!eventId) return [];
  const data = await calendlyRequest<{ collection: CalendlyInvitee[] }>(
    `/scheduled_events/${eventId}/invitees`,
  );
  return data.collection;
}

async function findVisitorByEmailAndDate(email: string, date: string) {
  const { data, error } = await supabase
    .from("kastle")
    .select("*")
    .eq("email", email)
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to find visitor: ${error.message}`);
  }

  return data ?? null;
}

async function createVisitorRecord(data: { name: string; email: string; date: string; event_name?: string }) {
  const { data: visitor, error } = await supabase
    .from("kastle")
    .insert({
      name: data.name,
      email: data.email,
      date: data.date,
      event_name: data.event_name,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create visitor: ${error.message}`);
  }

  return visitor;
}

function buildApprovalEmailHtml(data: { visitorName: string; visitorEmail: string; visitDate: string; approvalUrl: string }) {
  const date = new Date(data.visitDate);
  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Action Required: Visitor Access Authorization</title>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
  .email-container { max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden; }
  .header { background-color: #2c3e50; color: #fff; padding: 20px; text-align: center; }
  .content { padding: 30px; }
  .button-container { text-align: center; margin: 30px 0 20px; }
  .button { display: inline-block; padding: 12px 25px; background-color: #007bff; color: #fff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
  .footer { background-color: #eee; color: #777; padding: 20px; text-align: center; font-size: 0.9em; }
  .highlight { font-weight: bold; color: #007bff; }
</style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h2>Visitor Access Authorization Request</h2>
    </div>
    <div class="content">
      <p>Dear Dan,</p>
      <p>This is RubixOne. We require your authorization for visitor access based on a recent scheduling event.</p>
      <p>Do you authorize access for <span class="highlight">${data.visitorName}</span> on <span class="highlight">${formattedDate}</span>?</p>
      <p>Visitor's Email: <span class="highlight">${data.visitorEmail}</span></p>
      <p>If you authorize this access, please click the link below to confirm:</p>
      <div class="button-container">
        <a href="${data.approvalUrl}" class="button">Authorize Access</a>
      </div>
      <p>If you do not wish to authorize this access, no further action is required and you can safely ignore this email.</p>
      <p>Thank you for your prompt attention to this matter.</p>
      <p>Sincerely,<br/>The RubixOne Team</p>
    </div>
    <div class="footer">&copy; 2025 RubixOne. All rights reserved.</div>
  </div>
</body>
</html>`;
}

async function sendApprovalEmail(data: { visitorName: string; visitorEmail: string; visitDate: string; approvalUrl: string }) {
  const payload = {
    from: config.resendFrom,
    to: [config.danEmail],
    cc: config.opsCc ? [config.opsCc] : undefined,
    subject: `Viewing Authorization - ${data.visitorName}`,
    html: buildApprovalEmailHtml(data),
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send approval email: ${text}`);
  }
}

async function processEvent(event: CalendlyScheduledEvent) {
  if (!isFrameworkWilliamsburg(event.name)) {
    return { created: 0, skipped: 1 };
  }

  const invitees = await fetchInvitees(event.uri);
  let created = 0;
  let skipped = 0;

  for (const invitee of invitees) {
    if (invitee.status !== "active") {
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

    const approvalUrl = `${config.appBaseUrl}/api/approve?kastleid=${visitor.id}`;
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

async function handler() {
  const minStartTime = new Date(Date.now() - config.lookbackHours * 60 * 60 * 1000).toISOString();
  const events = await fetchRecentEvents(minStartTime);

  let processed = 0;
  let created = 0;
  let skipped = 0;

  for (const event of events) {
    const result = await processEvent(event);
    processed += 1;
    created += result.created;
    skipped += result.skipped;
  }

  return { ok: true, summary: { processed, created, skipped } };
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await handler();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Calendly poll edge function failed", error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
