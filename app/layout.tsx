import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { THEME_SCRIPT } from "@/components/theme-toggle";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${body.variable} ${display.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
