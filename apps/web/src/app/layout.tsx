import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Inference Gateway',
  description: 'Multi-LLM routing and tokenomics platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
