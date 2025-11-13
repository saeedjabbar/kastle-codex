# Kastle Visitor Authorization Service

This Next.js API replaces the legacy n8n workflow that handled Calendly tour bookings, routed approval requests to Dan, and provisioned visitors into Kastle.

## Getting Started

- Install dependencies: `npm install`
- Copy `.env.example` to `.env.local` and populate all secrets.
- Start the dev server: `npm run dev`

## Calendly Webhook

`POST /api/calendly/webhook` ingests `invitee.created` payloads from Calendly. It verifies the webhook signature when `CALENDLY_WEBHOOK_SECRET` is set, filters to the configured event name, persists the booking in Supabase, and emails Dan an approval link.

## Approval Flow

`GET /api/approve?token=...` is linked from the email. When the token is opened we:

1. Mark the Supabase row as processing.
2. Log into Kastle using the form-flow replicated from the legacy workflow.
3. Submit the pre-authorized visitor payload.
4. Update Supabase with the resulting status and return a branded confirmation page.

## Deployment Notes

- Target Vercel or Netlify. Expose `APP_BASE_URL` so approval links resolve correctly in emails.
- Store Supabase service keys, Kastle credentials, and email provider tokens as env secrets. Never commit them.
- Configure Calendly webhooks to point to your deployed `/api/calendly/webhook` URL and refresh the signing key if you rotate secrets.
- Supabase requires the `kastle` (or `SUPABASE_VISITOR_TABLE`) table to include `approval_token`, `status`, `approval_clicked_at`, `authorized_at`, `failure_reason`, and `calendly_payload` columns.
