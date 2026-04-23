import "dotenv/config";

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "L77wdSqisJqURhUuLzcU";
const APP_BASE_URL = process.env.APP_BASE_URL;
const BASE_URL = "https://services.leadconnectorhq.com/webhooks/";

if (!GHL_API_KEY) {
  console.error("Missing GHL_API_KEY environment variable");
  process.exit(1);
}

const headers: Record<string, string> = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-04-15",
  "Content-Type": "application/json",
};

async function register() {
  if (!APP_BASE_URL) {
    console.error("Missing APP_BASE_URL environment variable");
    process.exit(1);
  }

  const body = {
    url: `${APP_BASE_URL}/api/ghl/webhook`,
    events: ["AppointmentCreate"],
    locationId: GHL_LOCATION_ID,
  };

  console.log("Registering webhook...");
  console.log("URL:", body.url);
  console.log("Events:", body.events.join(", "));

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Failed (${res.status}):`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Webhook registered successfully:");
  console.log(JSON.stringify(data, null, 2));
}

async function list() {
  console.log(`Listing webhooks for location ${GHL_LOCATION_ID}...`);

  const res = await fetch(`${BASE_URL}?locationId=${GHL_LOCATION_ID}`, {
    method: "GET",
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Failed (${res.status}):`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

async function remove(webhookId: string) {
  console.log(`Deleting webhook ${webhookId}...`);

  const res = await fetch(`${BASE_URL}${webhookId}`, {
    method: "DELETE",
    headers,
  });

  if (res.status === 204 || res.ok) {
    console.log("Webhook deleted successfully.");
    return;
  }

  const data = await res.json();
  console.error(`Failed (${res.status}):`, JSON.stringify(data, null, 2));
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0] || "--register";

switch (command) {
  case "--register":
    register();
    break;
  case "--list":
    list();
    break;
  case "--delete":
    if (!args[1]) {
      console.error("Usage: --delete <webhookId>");
      process.exit(1);
    }
    remove(args[1]);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Usage: npx tsx scripts/setup-ghl-webhook.ts [--register | --list | --delete <webhookId>]");
    process.exit(1);
}
