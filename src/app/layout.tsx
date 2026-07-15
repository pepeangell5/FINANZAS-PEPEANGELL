import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pepeangell.dev"),
  title: "Finanzas privadas | ESP32-TOOLS",
  description: "Panel financiero privado de ESP32-TOOLS.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: "/finanzas",
  },
  icons: {
    icon: [
      { url: "/finanzas/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/finanzas/icon.png",
    apple: "/finanzas/apple-icon.png",
  },
  openGraph: {
    title: "Finanzas privadas | ESP32-TOOLS",
    description: "Acceso privado.",
    url: "https://www.pepeangell.dev/finanzas",
    siteName: "ESP32-TOOLS",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Finanzas privadas | ESP32-TOOLS",
    description: "Acceso privado.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-950">{children}</body>
    </html>
  );
}
