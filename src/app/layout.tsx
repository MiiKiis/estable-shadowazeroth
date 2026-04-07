import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./effects.css";
import ClientHeader from "@/components/ClientHeader";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://shadowazeroth.com"),
  title: {
    default: "Shadow Azeroth | Servidor WoW WotLK 3.3.5a",
    template: "%s | Shadow Azeroth",
  },
  description: "Servidor WoW WotLK 3.3.5a con comunidad activa, marketplace, foro, eventos y progreso constante para jugadores de Latinoamerica.",
  keywords: [
    "WoW",
    "World of Warcraft",
    "WotLK",
    "Servidor WoW",
    "Servidor 3.3.5a",
    "Shadow Azeroth",
    "MMORPG",
    "foro WoW",
    "marketplace WoW",
    "Latinoamerica",
    "Bolivia",
  ],
  authors: [{ name: "Shadow Azeroth Team" }],
  creator: "Shadow Azeroth Team",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "Shadow Azeroth | Servidor WoW WotLK 3.3.5a",
    description: "Comunidad activa, marketplace, foro y eventos para nuevos y veteranos en WotLK 3.3.5a.",
    type: "website",
    locale: "es_ES",
    siteName: "SHADOW AZEROTH",
    url: "https://shadowazeroth.com",
    images: [
      {
        url: "/logo-shadow.png",
        width: 1200,
        height: 630,
        alt: "Shadow Azeroth",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shadow Azeroth | Servidor WoW WotLK 3.3.5a",
    description: "Explora marketplace, foro y eventos en una comunidad activa de WotLK.",
    images: ["/logo-shadow.png"],
    creator: "@shadowazeroth",
  },
  category: "games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" />
        <script dangerouslySetInnerHTML={{ __html: `var whTooltips = { colorLinks: true, iconizeLinks: true, renameLinks: true };` }} />
        <script src="https://wow.zamimg.com/js/tooltips.js" async></script>
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ClientHeader />
        <main className="flex-grow overflow-x-clip w-full max-w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
