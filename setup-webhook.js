#!/usr/bin/env node

/**
 * Script to set up Calendly webhook subscription via API
 * This creates a webhook that triggers on invitee.created events
 */

const https = require('https');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config();

const CALENDLY_PAT = process.env.CALENDLY_API_TOKEN || process.env.CALENDLY_PAT;

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
const REPLACE_EXISTING = process.env.CALENDLY_REPLACE_EXISTING === 'true';
const CALENDLY_SIGNING_SECRET = process.env.CALENDLY_WEBHOOK_SECRET;

function getWebhookId(resource) {
  if (!resource) return undefined;
  if (resource.id) return resource.id;
  if (resource.uri) {
    const segments = resource.uri.split('/');
    return segments[segments.length - 1];
  }
  return undefined;
}

if (!CALENDLY_PAT) {
  console.error('❌ Missing Calendly Personal Access Token.');
  console.error('   Set CALENDLY_API_TOKEN (preferred) or CALENDLY_PAT in your environment.');
  process.exit(1);
}

if (!CALENDLY_SIGNING_SECRET) {
  console.error('❌ Missing CALENDLY_WEBHOOK_SECRET.');
  console.error('   Set it to the value you want Calendly to sign webhooks with (use the same value in Vercel).');
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
        'Authorization': `Bearer ${CALENDLY_PAT}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const bodyText = data.trim();
          const response = bodyText ? JSON.parse(bodyText) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            const message = response.message || bodyText || res.statusMessage;
            reject(new Error(`API Error ${res.statusCode}: ${message}`));
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
    scope: 'organization',
    signing_key: CALENDLY_SIGNING_SECRET
  };

  console.log('📤 Sending webhook data:', JSON.stringify(webhookData, null, 2));

  const executeCreate = () =>
    makeCalendlyRequest('/webhook_subscriptions', {
      method: 'POST',
      data: webhookData
    });

  try {
    const response = await executeCreate();

    const webhookId = getWebhookId(response.resource);

    console.log('✅ Webhook subscription created successfully!');
    console.log('📋 Subscription details:');
    console.log(`   ID: ${webhookId ?? 'unknown'}`);
    console.log(`   URL: ${response.resource.callback_url || response.resource.url}`);
    console.log(`   Events: ${response.resource.events.join(', ')}`);
    console.log(`   State: ${response.resource.state}`);
    const signingSecret = response.resource.secret || response.resource.signing_key || CALENDLY_SIGNING_SECRET;
    if (signingSecret) {
      console.log('🔑 Webhook signing secret (add to CALENDLY_WEBHOOK_SECRET in Vercel):');
      console.log(`   ${signingSecret}`);
    } else {
      console.log('⚠️  Calendly did not return a signing secret; try deleting and recreating again if needed.');
    }

    return response.resource;
  } catch (error) {
    if (error.message.includes('API Error 409') && REPLACE_EXISTING) {
      console.log('⚠️  Webhook already exists, attempting to replace it...');
      const existing = await checkExistingWebhooks(organizationUUID);
      if (existing) {
        const existingId = getWebhookId(existing);
        if (existingId) {
          await deleteWebhookSubscription(existingId);
        } else {
          console.log('ℹ️  Unable to determine webhook ID for deletion; please remove it manually in Calendly.');
          throw error;
        }
        console.log('🔁 Retrying webhook creation...');
        return createWebhookSubscription(organizationUUID);
      }
      console.log('ℹ️  No matching webhook found to delete; please remove it manually in Calendly.');
    }

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

  const orgUrl = `https://api.calendly.com/organizations/${organizationUUID}`;

  const fetchList = async () => {
    try {
      return await makeCalendlyRequest(
        `/webhook_subscriptions?scope=organization&organization=${encodeURIComponent(orgUrl)}`
      );
    } catch (error) {
      if (error.message.includes('API Error 400')) {
        console.log('ℹ️  Filtered webhook query not supported, falling back to full list');
        return await makeCalendlyRequest('/webhook_subscriptions');
      }
      throw error;
    }
  };

  try {
    const response = await fetchList();
    const existingWebhooks = response.collection.filter(webhook =>
      (webhook.callback_url || webhook.url) === WEBHOOK_URL &&
      webhook.events.includes('invitee.created')
    );

    if (existingWebhooks.length > 0) {
      console.log('⚠️  Webhook already exists:');
      existingWebhooks.forEach(webhook => {
        console.log(`   ID: ${getWebhookId(webhook) ?? 'unknown'}, State: ${webhook.state}`);
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
 * Delete an existing webhook subscription
 */
async function deleteWebhookSubscription(webhookId) {
  console.log(`🗑️  Deleting existing webhook ${webhookId}...`);
  try {
    await makeCalendlyRequest(`/webhook_subscriptions/${webhookId}`, {
      method: 'DELETE'
    });
    console.log('✅ Existing webhook deleted');
  } catch (error) {
    console.error('❌ Failed to delete existing webhook:', error.message);
    throw error;
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
      if (REPLACE_EXISTING) {
        const existingId = getWebhookId(existingWebhook);
        if (existingId) {
          await deleteWebhookSubscription(existingId);
        } else {
          console.log('ℹ️  Unable to determine webhook ID for deletion; please remove it manually in Calendly.');
          return;
        }
      } else {
        console.log('⚠️  A webhook for this URL already exists.');
        console.log('    To replace it automatically, re-run with CALENDLY_REPLACE_EXISTING=true.');
        console.log('    Example: CALENDLY_REPLACE_EXISTING=true npm run setup:webhook');
        return;
      }
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
