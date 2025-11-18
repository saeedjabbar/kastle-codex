import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

// Use the verified domain for testing
process.env.RESEND_FROM_EMAIL = 'noreply@rubixone.incl.us';
// Test sending to Dan's email now that domain is verified
process.env.DAN_NOTIFICATION_EMAIL = process.env.DAN_NOTIFICATION_EMAIL || 'dan@framework.nyc';

import { sendApprovalEmail } from './lib/email';

async function testEmail() {
  console.log('Testing Resend email sending...\n');
  
  // Test data - sending to your own email for testing (required until domain is verified)
  const testData = {
    visitorName: 'Test Visitor',
    visitorEmail: 'test@example.com',
    visitDate: new Date().toISOString(),
    approvalUrl: 'https://example.com/api/approve?kastleid=test-123'
  };

  try {
    console.log('Sending test email with data:');
    console.log('- Visitor Name:', testData.visitorName);
    console.log('- Visitor Email:', testData.visitorEmail);
    console.log('- Visit Date:', testData.visitDate);
    console.log('- Approval URL:', testData.approvalUrl);
    console.log('\nSending...\n');

    await sendApprovalEmail(testData);
    
    console.log('\n✅ Email sent successfully!');
    console.log(`Email sent TO: ${process.env.DAN_NOTIFICATION_EMAIL || 'dan@framework.nyc'}`);
    console.log(`Email CC: ${process.env.OPS_CC_EMAIL || 'saeed@incl.us'}`);
    console.log(`Email FROM: ${process.env.RESEND_FROM_EMAIL || 'noreply@rubixone.incl.us'}`);
    console.log('\n📧 Check the inboxes for the test email!');
  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(error);
    process.exit(1);
  }
}

testEmail();

