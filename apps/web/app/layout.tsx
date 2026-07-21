import type { Metadata } from "next";
import { Archivo, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { getCurrentUser } from "@/lib/auth";
import { baseUrl } from "@/lib/public-api";

/**
 * "Test Bench" type system: Archivo (wide, heavy) for display, Instrument Sans
 * for body, IBM Plex Mono for the data/readout language.
 */
const display = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: "AIx — is this AI tool actually worth it?",
  description:
    "A harshly-honest directory of trending AI/GitHub tools plus the takes of the engineers who run them.",
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const themeScript = `(() => {
  try {
    const t = localStorage.getItem('theme');
    const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Nav />
        {/* pb clears the fixed mobile tab bar (ticket 0030). */}
        <main className="mx-auto max-w-6xl px-4 py-8 pb-20 sm:pb-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-12 pb-24 text-center sm:pb-12">
          <p className="data text-[11px] uppercase tracking-[0.2em] text-faint">
            AIx · <span className="text-brand">signal</span> over noise
          </p>
          <p className="data mt-2 text-[11px] uppercase tracking-[0.2em] text-faint">
            <a className="hover:text-brand" href="/privacy">
              Privacy
            </a>
          </p>
        </footer>
        <MobileNav username={user?.username ?? null} />
      </body>
    </html>
  );
}
