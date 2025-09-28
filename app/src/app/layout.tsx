import './globals.css';

// Define metadata for consistent server/client rendering
export const metadata = {
  title: 'Rashomon',
  description: 'Reading and Discussion Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}