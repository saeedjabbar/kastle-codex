import { NextRequest, NextResponse } from 'next/server';
import { getVisitorRecord, updateVisitorStatus } from '@/lib/supabase';
import { authenticateAndCreateVisitor } from '@/lib/kastle';

/**
 * Approval webhook handler
 * Handles approval clicks from email and creates visitor in Kastle
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const kastleId = searchParams.get('kastleid');

  if (!kastleId) {
    return new NextResponse(getErrorHtml('Missing visitor ID'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    // Fetch visitor record from Supabase
    const visitor = await getVisitorRecord(kastleId);

    if (!visitor) {
      return new NextResponse(getErrorHtml('Visitor record not found'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Check if already processed
    if (visitor.status !== 'pending') {
      return new NextResponse(
        getSuccessHtml(visitor.name, visitor.date, visitor.email, 'already processed'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // Authenticate with Kastle and create visitor
    const result = await authenticateAndCreateVisitor({
      name: visitor.name,
      email: visitor.email,
      date: visitor.date
    });

    if (result.success) {
      // Update status to approved
      await updateVisitorStatus(visitor.id, 'approved');

      return new NextResponse(
        getSuccessHtml(visitor.name, visitor.date, visitor.email),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    } else {
      // Update status to failed
      await updateVisitorStatus(visitor.id, 'failed');

      return new NextResponse(
        getErrorHtml(`Failed to create visitor in Kastle: ${result.message || 'Unknown error'}`),
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
  } catch (error) {
    console.error('Approval webhook error:', error);
    return new NextResponse(
      getErrorHtml(error instanceof Error ? error.message : 'Unknown error'),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

function getSuccessHtml(name: string, date: string, email: string, status?: string): string {
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visitor Authorization Confirmation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            background-color: #fff;
            max-width: 600px;
            margin: 20px auto;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 20px;
        }
        p {
            margin-bottom: 10px;
        }
        strong {
            color: #34495e;
        }
        .highlight {
            font-weight: bold;
            color: #007bff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Visitor Authorization Confirmation</h1>
        <p>
            <strong>RubixOne:</strong> <span class="highlight">${name}</span> successfully authorized on Kastle for <span class="highlight">${formattedDate}</span> using <span class="highlight">${email}</span>.
        </p>
        ${status === 'already processed' ? '<p><em>This visitor was already processed.</em></p>' : ''}
        <p>Thank you for using our service.</p>
    </div>
</body>
</html>`;
}

function getErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error Notification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            background-color: #fff;
            max-width: 600px;
            margin: 20px auto;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            border-left: 5px solid #dc3545;
        }
        h1 {
            color: #dc3545;
            text-align: center;
            margin-bottom: 20px;
        }
        p {
            margin-bottom: 10px;
            color: #555;
        }
        strong {
            color: #dc3545;
        }
        .contact-info {
            margin-top: 20px;
            text-align: center;
            font-size: 0.9em;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Attention: System Error</h1>
        <p>
            <strong>RubixOne:</strong> Something went wrong, please contact admin.
        </p>
        <p>Error: ${message}</p>
        <p class="contact-info">
            If you continue to experience issues, please reach out to your system administrator for assistance.
        </p>
    </div>
</body>
</html>`;
}

