import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Visitor Authorization System',
  description: 'Automated visitor authorization for Kastle building access',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

