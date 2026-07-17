import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

export const metadata: Metadata = {
  title: "BadmintonSG — court transfers & find players",
  description: "Grab a balloted badminton court someone can't use, or find players for your game.",
};

export const viewport: Viewport = {
  themeColor: "#14532d",
};

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-court/40">
      <span className="flex size-8 items-center justify-center rounded-lg bg-court text-court-light" aria-hidden>
        {/* shuttlecock: cork + feather skirt */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="18.5" r="2.6" fill="currentColor" stroke="none" />
          <path d="M12 16 L6 5" /><path d="M12 16 L9 4" /><path d="M12 16 L12 3.5" />
          <path d="M12 16 L15 4" /><path d="M12 16 L18 5" />
          <path d="M6 5 L18 5" opacity="0.6" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-tight text-court">
        Badminton<span className="text-gray-900">SG</span>
      </span>
    </Link>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-gray-900 antialiased">
        <SmoothScroll />
        <header className="sticky top-0 z-40 border-b border-court/10 bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 md:max-w-3xl lg:max-w-5xl">
            <Wordmark />
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Singapore
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 pb-24 pt-4 md:max-w-3xl lg:max-w-5xl">{children}</main>
        <footer className="mx-auto max-w-md px-4 pb-6 text-center text-xs text-gray-400 md:max-w-3xl lg:max-w-5xl">
          <p>
            We store only your post details and phone number, and delete numbers 14 days after a
            post expires. IPs are stored hashed, for rate limiting only.
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
