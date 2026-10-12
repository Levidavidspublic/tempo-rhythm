import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { themeInitScript } from "@/lib/theme-script";

const newsreader = localFont({
  src: "../fonts/newsreader/Newsreader-latin.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const ibmPlexMono = localFont({
  src: [
    {
      path: "../fonts/ibm-plex-mono/IBMPlexMono-latin-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/ibm-plex-mono/IBMPlexMono-latin-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/ibm-plex-mono/IBMPlexMono-latin-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-ibm-mono",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "Tempo Flow — your brain's operating system",
  description:
    "An overwhelm-first AI daily planner for ADHD, autistic, and neurodivergent brains.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3EEE4" },
    { media: "(prefers-color-scheme: dark)", color: "#161412" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        dir="ltr"
        className={`${newsreader.variable} ${ibmPlexMono.variable}`}
        suppressHydrationWarning
      >
        <head>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-hydration theme script, locally generated, no user input */}
          <Script id="tempo-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        </head>
        <body className="antialiased" suppressHydrationWarning>
          <ThemeProvider>
            <Providers>{children}</Providers>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
