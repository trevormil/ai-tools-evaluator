import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-neutral-400">
          AIx · signal over noise
        </footer>
      </body>
    </html>
  );
}
