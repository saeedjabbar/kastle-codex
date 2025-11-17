export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Visitor Authorization System</h1>
        <p className="text-lg text-gray-600">
          System is running. Webhook endpoints are available at:
        </p>
        <ul className="mt-4 space-y-2">
          <li className="text-blue-600">
            <code>POST /api/calendly</code> - Receives Calendly webhooks
          </li>
          <li className="text-blue-600">
            <code>{'GET /api/approve?kastleid={uuid}'}</code> - Handles approval clicks
          </li>
        </ul>
      </div>
    </main>
  );
}

