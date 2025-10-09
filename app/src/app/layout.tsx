import './globals.css';

import type { Metadata } from 'next';
import { getServerRuntimeEnv, serializeRuntimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rashomon',
  description: 'Reading and Discussion Platform',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeEnv = getServerRuntimeEnv();
  const serialized = serializeRuntimeEnv(runtimeEnv);

  // DEBUG: Server-side logging
  console.log('[LAYOUT DEBUG] Server runtime env:', runtimeEnv);
  console.log('[LAYOUT DEBUG] Serialized for browser:', serialized);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          id="__rashomon-env__"
          dangerouslySetInnerHTML={{
            __html: `window.__RASHOMON_ENV__=${serialized};`,
          }}
        />
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}