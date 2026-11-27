import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import { BackgroundFx } from "@/components/background-fx";
import { normalizeBackground } from "@/lib/background";
import "./globals.css";

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ChupaSocial — a rede social com gosto próprio",
    template: "%s · ChupaSocial",
  },
  description:
    "Publique, siga, converse e participe de comunidades no ChupaSocial. Uma rede social independente, feita para conversar de verdade.",
  applicationName: "ChupaSocial",
  openGraph: {
    title: "ChupaSocial",
    description: "Uma rede social independente, feita para conversar de verdade.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0b11" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const storedTheme = jar.get("chupa-theme")?.value;
  const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : undefined;
  const background = normalizeBackground(jar.get("chupa-bg")?.value);

  return (
    <html lang="pt-BR" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${body.variable} ${display.variable} font-sans antialiased`}>
        <BackgroundFx initial={background} />
        {children}
      </body>
    </html>
  );
}
