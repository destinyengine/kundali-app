import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Web3AuthProvider } from '@/contexts/Web3AuthContext';
import { Toaster } from 'sonner';
import Navbar from '@/components/navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Destiny Engine - Vedic Astrology',
  description: 'A modern approach to ancient wisdom. Generate your Kundali and receive AI-powered Vedic interpretations.',
  icons: {
    icon: '/astrology.png', // Now served from public folder
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Web3AuthProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-grow">{children}</main>
            </div>
            <Toaster />
          </Web3AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}