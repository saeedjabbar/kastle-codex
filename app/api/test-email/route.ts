import { NextRequest, NextResponse } from 'next/server';
import { sendApprovalEmail } from '@/lib/email';

// Mark this route as dynamic since it uses searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for customization (optional)
    const searchParams = request.nextUrl.searchParams;
    const visitorName = searchParams.get('name') || 'Test Visitor';
    const visitorEmail = searchParams.get('email') || 'test@example.com';
    const visitDate = searchParams.get('date') || new Date().toISOString();
    
    // Get base URL for approval link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'http://localhost:3000');
    
    const approvalUrl = `${baseUrl}/api/approve?kastleid=test-123`;

    console.log('Sending test email...');
    console.log('Visitor Name:', visitorName);
    console.log('Visitor Email:', visitorEmail);
    console.log('Visit Date:', visitDate);

    await sendApprovalEmail({
      visitorName,
      visitorEmail,
      visitDate,
      approvalUrl
    });

    return NextResponse.json(
      { 
        success: true,
        message: 'Test email sent successfully!',
        details: {
          visitorName,
          visitorEmail,
          visitDate,
          sentTo: 'dan@framework.nyc',
          ccTo: 'saeed@incl.us'
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

