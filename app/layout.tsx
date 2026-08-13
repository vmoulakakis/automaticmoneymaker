import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'EU Stock Intelligence',
  description: 'Autonomous AliExpress EU-stock demand intelligence and forecasting',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div>
            <div className="brand">EU Stock Intelligence</div>
            <div className="subbrand">Autonomous demand & opportunity engine</div>
          </div>
          <nav>
            <Link href="/">Monitor</Link>
            <Link href="/config">Configuration</Link>
          </nav>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
