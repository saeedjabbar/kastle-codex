import { NextRequest, NextResponse } from 'next/server';
import { createVisitorRecord } from '@/lib/supabase';
import { sendApprovalEmail } from '@/lib/email';
import type { CalendlyWebhookPayload } from '@/types';

/**
 * Calendly webhook handler
 * Receives webhook when someone books a tour appointment
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (optional but recommended)
    const signature = request.headers.get('calendly-webhook-signature');
    const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;
    
    // Note: Full signature verification would require crypto operations
    // For now, we'll just check if the secret is configured
    if (!webhookSecret) {
      console.warn('CALENDLY_WEBHOOK_SECRET not configured');
    }

    const payload: CalendlyWebhookPayload = await request.json();

    // Check if this is an invitee.created event
    if (payload.event !== 'invitee.created') {
      return NextResponse.json(
        { message: 'Event type not supported' },
        { status: 400 }
      );
    }

    // Check if event is "Tour of Framework (Williamsburg)"
    // Based on n8n workflow, it checks scheduled_event.name
    const eventName = payload.payload.scheduled_event?.name || '';
    if (!eventName.includes('Tour of Framework')) {
      return NextResponse.json(
        { message: 'Event not applicable for visitor authorization' },
        { status: 200 } // Return 200 to acknowledge webhook
      );
    }

    // Extract visitor data
    const visitorName = payload.payload.name;
    const visitorEmail = payload.payload.email;
    const visitDate = payload.payload.scheduled_event.start_time;

    if (!visitorName || !visitorEmail || !visitDate) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create visitor record in Supabase
    const visitor = await createVisitorRecord({
      name: visitorName,
      email: visitorEmail,
      date: visitDate,
      event_name: eventName
    });

    // Get the base URL for the approval link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'http://localhost:3000');
    
    const approvalUrl = `${baseUrl}/api/approve?kastleid=${visitor.id}`;

    // Send approval email to Dan
    await sendApprovalEmail({
      visitorName,
      visitorEmail,
      visitDate,
      approvalUrl
    });

    return NextResponse.json(
      { 
        message: 'Visitor record created and approval email sent',
        visitorId: visitor.id 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Calendly webhook error:', error);
    return NextResponse.json(
      { 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

