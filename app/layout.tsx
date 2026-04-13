import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stoca — Your Neighborhood Stores, Online',
  description: 'AI-native local commerce platform connecting you with neighborhood stores.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
