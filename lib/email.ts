import { Resend } from 'resend';

const FROM_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL ?? 'notifications@rubixone.example';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY. Add it to your environment.');
  }

  return new Resend(apiKey);
}

function formatDate(dateIso: string) {
  const date = new Date(dateIso);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function sendApprovalEmail(payload: {
  visitorName: string;
  visitorEmail: string;
  scheduledFor: string;
  approvalUrl: string;
}) {
  const resend = getResendClient();

  const to = process.env.DAN_NOTIFICATION_EMAIL;

  if (!to) {
    throw new Error('Missing DAN_NOTIFICATION_EMAIL. Add it to your environment.');
  }

  const ccList = process.env.OPS_CC_EMAIL ? [process.env.OPS_CC_EMAIL] : [];

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visitor Access Authorization</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
      .email-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background-color: #2c3e50; color: #ffffff; padding: 20px; text-align: center; }
      .content { padding: 30px; }
      .button-container { text-align: center; margin-top: 30px; margin-bottom: 20px; }
      .button { display: inline-block; padding: 12px 25px; background-color: #007bff; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
      .footer { background-color: #eeeeee; color: #777777; padding: 20px; text-align: center; font-size: 0.9em; }
      .highlight { font-weight: bold; color: #007bff; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <h2>Visitor Access Authorization Needed</h2>
      </div>
      <div class="content">
        <p>Hey Dan,</p>
        <p>
          RubixOne captured a new tour booking and needs your authorization to load the visitor into Kastle.
        </p>
        <p>
          Visitor: <span class="highlight">${payload.visitorName}</span><br />
          Email: <span class="highlight">${payload.visitorEmail}</span><br />
          Visit Date: <span class="highlight">${formatDate(payload.scheduledFor)}</span>
        </p>
        <p>If you approve this access, click the link below:</p>
        <div class="button-container">
          <a href="${payload.approvalUrl}" class="button">Authorize Access</a>
        </div>
        <p>If you do not authorize, simply ignore this email.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} RubixOne. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    cc: ccList,
    subject: `Viewing Authorization - ${payload.visitorName}`,
    html,
  });
}
