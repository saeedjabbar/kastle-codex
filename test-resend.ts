import { sendApprovalEmail } from './lib/email';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmail() {
  console.log('Testing Resend email sending...\n');
  
  // Test data
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
    
    console.log('✅ Email sent successfully!');
    console.log('Check the inbox for:', process.env.RESEND_FROM_EMAIL || 'dan@framework.nyc');
  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(error);
    process.exit(1);
  }
}

testEmail();

