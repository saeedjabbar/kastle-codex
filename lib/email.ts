import { Resend } from 'resend';

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const APPROVAL_EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'; // Update with your verified domain
const APPROVAL_EMAIL_TO = 'rubixone@framework.nyc';
const APPROVAL_EMAIL_CC = 'saeed@incl.us';

export interface ApprovalEmailData {
  visitorName: string;
  visitorEmail: string;
  visitDate: string;
  approvalUrl: string;
}

/**
 * Sends approval email to Dan with visitor details and approval link
 */
export async function sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
  const { visitorName, visitorEmail, visitDate, approvalUrl } = data;

  // Format date for display
  const date = new Date(visitDate);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Action Required: Visitor Access Authorization</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background-color: #2c3e50;
            color: #ffffff;
            padding: 20px;
            text-align: center;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
        }
        .content {
            padding: 30px;
        }
        .button-container {
            text-align: center;
            margin-top: 30px;
            margin-bottom: 20px;
        }
        .button {
            display: inline-block;
            padding: 12px 25px;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            font-size: 16px;
        }
        .footer {
            background-color: #eeeeee;
            color: #777777;
            padding: 20px;
            text-align: center;
            font-size: 0.9em;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
        }
        .highlight {
            font-weight: bold;
            color: #007bff;
        }
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
            <p>
                Do you authorize access for <span class="highlight">${visitorName}</span> on <span class="highlight">${formattedDate}</span>?
            </p>
            <p>
                Visitor's Email: <span class="highlight">${visitorEmail}</span>
            </p>
            <p>
                If you authorize this access, please click the link below to confirm:
            </p>
            <div class="button-container">
                <a href="${approvalUrl}" class="button">
                    Authorize Access
                </a>
            </div>
            <p>
                If you do not wish to authorize this access, no further action is required and you can safely ignore this email.
            </p>
            <p>Thank you for your prompt attention to this matter.</p>
            <p>Sincerely,<br>The RubixOne Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 RubixOne. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;

  if (!resend) {
    throw new Error('Resend API key is not configured');
  }

  try {
    await resend.emails.send({
      from: APPROVAL_EMAIL_FROM,
      to: APPROVAL_EMAIL_TO,
      cc: [APPROVAL_EMAIL_CC],
      subject: `Viewing Authorization - ${visitorName}`,
      html
    });
  } catch (error) {
    console.error('Failed to send approval email:', error);
    throw new Error(`Failed to send approval email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

