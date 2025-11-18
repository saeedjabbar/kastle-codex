require('dotenv').config();
const https = require('https');
const token = process.env.CALENDLY_API_TOKEN || process.env.CALENDLY_PAT;
const organization =
  process.env.CALENDLY_ORGANIZATION ||
  'https://api.calendly.com/organizations/49fe2c56-eaac-4ea6-b980-21b34ba4cd59';
if (!token) {
  throw new Error('Missing Calendly API token');
}
const path = `/webhook_subscriptions?scope=organization&organization=${encodeURIComponent(organization)}`;
const req = https.request({
  hostname: 'api.calendly.com',
  path,
  method: 'GET',
  headers: {
    Authorization: `Bearer ${token}`
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log(data);
  });
});
req.on('error', console.error);
req.end();
