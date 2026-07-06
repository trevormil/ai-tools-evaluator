import type { Metadata } from "next";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { getCurrentUser } from "@/lib/auth";

/**
 * "Scoreboard" type system (user-picked theme): Anton for jumbotron display,
 * Inter for commentary/body, JetBrains Mono for the score digits.
 */
const display = Anton({
  subsets: ["latin"],
  weight: "400", // Anton ships one weight — it IS the bold
  variable: "--font-display",
});
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AIx — is this AI tool actually worth it?",
  description:
    "A harshly-honest directory of trending AI/GitHub tools plus the takes of the engineers who run them.",
};

// Set the theme class before paint. Scoreboard is a NIGHT identity — dark is
// the default; light is the opt-in "day game" mode.
const themeScript = `(() => {
  try {
    const t = localStorage.getItem('theme');
    const dark = t ? t === 'dark' : true;
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
        </footer>
        <MobileNav username={user?.username ?? null} />
      </body>
    </html>
  );
}
