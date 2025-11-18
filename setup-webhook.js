#!/usr/bin/env node

/**
 * Script to set up Calendly webhook subscription via API
 * This creates a webhook that triggers on invitee.created events
 */

const https = require('https');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config();

const CALENDLY_TOKEN = process.env.CALENDLY_WEBHOOK_SECRET;

function resolveBaseUrl() {
  const explicit =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL;

  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

// For Vercel deployment, the URL will be auto-detected
// In development, you can set APP_BASE_URL in .env
const APP_BASE_URL = resolveBaseUrl();

const WEBHOOK_URL = `${APP_BASE_URL}/api/calendly/webhook`;

if (!CALENDLY_TOKEN) {
  console.error('❌ CALENDLY_WEBHOOK_SECRET not found in .env file');
  process.exit(1);
}

console.log('🚀 Setting up Calendly webhook...');
console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);

/**
 * Make HTTPS request to Calendly API
 */
function makeCalendlyRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'api.calendly.com',
      path,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${CALENDLY_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${response.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Parse Error: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.data) {
      req.write(JSON.stringify(options.data));
    }

    req.end();
  });
}

/**
 * Get current user's Calendly organization
 */
async function getCurrentUser() {
  console.log('🔍 Getting current user info...');
  try {
    const response = await makeCalendlyRequest('/users/me');
    return response.resource;
  } catch (error) {
    console.error('❌ Failed to get user info:', error.message);
    throw error;
  }
}

/**
 * Get organization UUID from current user
 */
async function getOrganizationUUID(user) {
  // Extract organization UUID from current_organization href
  const orgHref = user.current_organization;
  if (!orgHref) {
    throw new Error('No current organization found for user');
  }

  // Extract UUID from URL: https://api.calendly.com/organizations/{uuid}
  const match = orgHref.match(/\/organizations\/([^\/]+)/);
  if (!match) {
    throw new Error(`Could not extract organization UUID from: ${orgHref}`);
  }

  return match[1];
}

/**
 * Create webhook subscription
 */
async function createWebhookSubscription(organizationUUID) {
  console.log('🔗 Creating webhook subscription...');

  const webhookData = {
    url: WEBHOOK_URL,
    events: ['invitee.created'],
    organization: `https://api.calendly.com/organizations/${organizationUUID}`,
    scope: 'organization'
  };

  console.log('📤 Sending webhook data:', JSON.stringify(webhookData, null, 2));

  try {
    const response = await makeCalendlyRequest('/webhook_subscriptions', {
      method: 'POST',
      data: webhookData
    });

    console.log('✅ Webhook subscription created successfully!');
    console.log('📋 Subscription details:');
    console.log(`   ID: ${response.resource.id}`);
    console.log(`   URL: ${response.resource.url}`);
    console.log(`   Events: ${response.resource.events.join(', ')}`);
    console.log(`   State: ${response.resource.state}`);

    return response.resource;
  } catch (error) {
    console.error('❌ Failed to create webhook subscription:', error.message);
    console.error('🔍 Full error details:', error);
    throw error;
  }
}

/**
 * Check if webhook already exists
 */
async function checkExistingWebhooks(organizationUUID) {
  console.log('🔍 Checking for existing webhooks...');

  try {
    const response = await makeCalendlyRequest('/webhook_subscriptions');
    const existingWebhooks = response.collection.filter(webhook =>
      webhook.url === WEBHOOK_URL &&
      webhook.events.includes('invitee.created')
    );

    if (existingWebhooks.length > 0) {
      console.log('⚠️  Webhook already exists:');
      existingWebhooks.forEach(webhook => {
        console.log(`   ID: ${webhook.id}, State: ${webhook.state}`);
      });
      return existingWebhooks[0];
    }

    return null;
  } catch (error) {
    console.log('ℹ️  Could not check existing webhooks (this is normal):', error.message);
    return null;
  }
}

/**
 * Main setup function
 */
async function setupWebhook() {
  try {
    // Get current user and organization
    const user = await getCurrentUser();
    console.log(`👤 User: ${user.name} (${user.email})`);

    const orgUUID = await getOrganizationUUID(user);
    console.log(`🏢 Organization UUID: ${orgUUID}`);

    // Check if webhook already exists
    const existingWebhook = await checkExistingWebhooks(orgUUID);
    if (existingWebhook) {
      console.log('✅ Webhook is already configured!');
      return;
    }

    // Create new webhook subscription
    const webhook = await createWebhookSubscription(orgUUID);

    console.log('\n🎉 Setup complete!');
    console.log('📧 Your Calendly webhook is now active.');
    console.log('🧪 Test it by booking a "Tour of Framework (Williamsburg)" event in Calendly.');

  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your CALENDLY_WEBHOOK_SECRET in .env file');
    console.log('2. Ensure your Calendly account has API access');
    console.log('3. Verify your Vercel deployment is live');
    process.exit(1);
  }
}

// Run the setup
setupWebhook();
