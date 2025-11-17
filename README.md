# Visitor Authorization System

A Next.js application that automates visitor authorization for Kastle building access system based on Calendly tour bookings.

## Features

- Receives Calendly webhooks when someone books a tour
- Stores visitor information in Supabase
- Sends approval email to Dan with authorization link
- Creates pre-authorized visitor in Kastle system upon approval

## Setup

### Prerequisites

- Node.js 18+ installed
- Supabase project with database access
- SendGrid account for sending emails
- Calendly account with webhook access

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Calendly Webhook
CALENDLY_WEBHOOK_SECRET=your-calendly-webhook-secret

# Kastle Credentials
KASTLE_USERNAME=your-kastle-username
KASTLE_PASSWORD=your-kastle-password

# SendGrid Email Service
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com  # Must be a verified sender in SendGrid

# Base URL (for production, set to your Vercel URL)
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
```

**Note:** The `.env` file already contains most variables. You need to add:
- `NEXT_PUBLIC_SUPABASE_URL` (same as `SUPABASE_URL`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same as `SUPABASE_ANON_KEY`)
- `SENDGRID_API_KEY` (get from SendGrid dashboard)
- `SENDGRID_FROM_EMAIL` (your verified sender email)
- `NEXT_PUBLIC_BASE_URL` (optional, will auto-detect on Vercel)

### Database Setup

The `kastle` table has already been created in Supabase with the following schema:

```sql
CREATE TABLE kastle (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## API Endpoints

### POST `/api/calendly`

Receives Calendly webhook when someone books a tour appointment.

**Webhook Setup:**
1. Go to Calendly Integrations → Webhooks
2. Add webhook endpoint: `https://your-domain.com/api/calendly`
3. Select event: `invitee.created`
4. Copy the webhook secret to `CALENDLY_WEBHOOK_SECRET`

### GET `/api/approve?kastleid={uuid}`

Handles approval clicks from email. This endpoint:
1. Fetches visitor record from Supabase
2. Authenticates with Kastle
3. Creates pre-authorized visitor in Kastle
4. Updates visitor status in Supabase
5. Returns success/failure HTML page

## Deployment to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

The `NEXT_PUBLIC_BASE_URL` will automatically be set by Vercel using `VERCEL_URL`, but you can override it if needed.

### Setting up Calendly Webhook

After deployment:
1. Get your production URL from Vercel
2. In Calendly, set webhook URL to: `https://your-domain.vercel.app/api/calendly`
3. Ensure webhook secret matches `CALENDLY_WEBHOOK_SECRET` in Vercel

## Email Configuration

1. Sign up for a SendGrid account at https://sendgrid.com
2. Get your API key from SendGrid dashboard (Settings → API Keys)
3. Add `SENDGRID_API_KEY` to your environment variables
4. Verify your sender email/domain in SendGrid dashboard (Settings → Sender Authentication)
5. Set `SENDGRID_FROM_EMAIL` to your verified sender email (e.g., `noreply@yourdomain.com`)

The email will be sent to `dan@framework.nyc` with CC to `saeed@incl.us` (configured in `lib/email.ts`).

## Workflow

1. **Visitor books tour** → Calendly sends webhook to `/api/calendly`
2. **System creates record** → Visitor info stored in Supabase with status `pending`
3. **Email sent** → Dan receives approval email with link to `/api/approve?kastleid={id}`
4. **Approval clicked** → System authenticates with Kastle and creates visitor
5. **Status updated** → Record status changed to `approved` or `failed`

## Troubleshooting

- **Emails not sending**: Check SendGrid API key and sender verification
- **Kastle authentication fails**: Verify credentials and check Kastle system status
- **Webhook not receiving**: Check Calendly webhook configuration and URL
- **Database errors**: Verify Supabase credentials and table permissions
