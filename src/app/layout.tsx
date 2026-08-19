import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

/**
 * PP Mori — ten sam krój co na ochronazklasa.pl.
 *
 * Panel jest narzędziem pracy, a nie broszurą, więc z warstwy wizualnej strony
 * bierzemy to, co niesie rozpoznawalność i nie przeszkadza w czytaniu: krój,
 * granat i błękit. Bez shaderów, poświat i animowanych gradientów — te są dla
 * odwiedzającego, który ogląda stronę raz, a nie dla kogoś, kto siedzi w tym
 * ekranie przez osiem godzin.
 */
const mori = localFont({
  src: [
    { path: "./fonts/PPMori-Extralight.otf", weight: "200", style: "normal" },
    { path: "./fonts/PPMori-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/PPMori-SemiBold.otf", weight: "600", style: "normal" },
  ],
  variable: "--font-marka",
  display: "swap",
  // Bez tego przy braku pliku pojawia się krój systemowy o innej szerokości
  // i tabele skaczą w trakcie ładowania.
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ochrona z Klasą — Panel",
  description: "Wewnętrzny panel do zarządzania polisami ubezpieczeniowymi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${mori.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
