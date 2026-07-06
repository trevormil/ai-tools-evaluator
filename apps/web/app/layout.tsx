import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AIx — is this AI tool actually worth it?",
  description:
    "A harshly-honest directory of trending AI/GitHub tools plus a social feed to discuss them.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Nav />
        {/* pb clears the fixed mobile tab bar (ticket 0030). */}
        <main className="mx-auto max-w-5xl px-4 py-8 pb-20 sm:pb-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-12 pb-24 text-center sm:pb-12">
          <p className="data text-[11px] uppercase tracking-[0.2em] text-faint">
            AIx · <span className="text-brand">signal</span> over noise
          </p>
        </footer>
        <MobileNav username={user?.username ?? null} />
      </body>
    </html>
  );
}
