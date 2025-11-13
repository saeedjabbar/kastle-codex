import { NextRequest, NextResponse } from 'next/server';
import {
  getVisitorByToken,
  markVisitorAuthorized,
  markVisitorFailed,
  markVisitorProcessing,
} from '@/lib/supabase';
import { authorizeKastleVisit } from '@/lib/kastle';

function formatDisplayDate(dateIso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateIso));
}

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function renderSuccess(visitorName: string, visitDateIso: string, visitorEmail: string) {
  const visitDate = formatDisplayDate(visitDateIso);
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visitor Authorization Confirmation</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
      .container { background-color: #fff; max-width: 600px; margin: 20px auto; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
      h1 { color: #2c3e50; text-align: center; margin-bottom: 20px; }
      .highlight { font-weight: bold; color: #007bff; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Visitor Authorization Confirmed</h1>
      <p>
        RubixOne authorized <span class="highlight">${visitorName}</span> on Kastle for
        <span class="highlight">${visitDate}</span> using
        <span class="highlight">${visitorEmail}</span>.
      </p>
      <p>You're all set!</p>
    </div>
  </body>
  </html>
  `;
}

function renderFailure(errorMessage: string) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Authorization Error</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
      .container { background-color: #fff; max-width: 600px; margin: 20px auto; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); border-left: 5px solid #dc3545; }
      h1 { color: #dc3545; text-align: center; margin-bottom: 20px; }
      p { color: #555; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Access Not Authorized</h1>
      <p>${errorMessage}</p>
      <p>Please retry or contact the administrator.</p>
    </div>
  </body>
  </html>
  `;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return htmlResponse(renderFailure('Missing approval token.'), 400);
  }

  let visitor;

  try {
    visitor = await getVisitorByToken(token);
  } catch (error) {
    console.error('Unable to load visitor', error);
    return htmlResponse(renderFailure('Visitor record not found.'), 404);
  }

  if (visitor.status === 'authorized') {
    return htmlResponse(
      renderSuccess(visitor.name, visitor.date, visitor.email),
    );
  }

  if (visitor.status === 'failed') {
    return htmlResponse(
      renderFailure(
        visitor.failure_reason ??
          'This request previously failed. Reach out to the admin team for assistance.',
      ),
      409,
    );
  }

  const username = process.env.KASTLE_USERNAME;
  const password = process.env.KASTLE_PASSWORD;

  if (!username || !password) {
    return htmlResponse(
      renderFailure('Kastle credentials are not configured.'),
      500,
    );
  }

  try {
    await markVisitorProcessing(visitor.id);

    await authorizeKastleVisit(
      { username, password },
      {
        name: visitor.name,
        email: visitor.email,
        scheduledFor: visitor.date,
      },
    );

    await markVisitorAuthorized(visitor.id);

    return htmlResponse(renderSuccess(visitor.name, visitor.date, visitor.email));
  } catch (error) {
    console.error('Kastle authorization failed', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected authorization error.';

    try {
      await markVisitorFailed(visitor.id, message);
    } catch (updateError) {
      console.error('Failed to persist failure state', updateError);
    }

    return htmlResponse(renderFailure(message), 500);
  }
}
