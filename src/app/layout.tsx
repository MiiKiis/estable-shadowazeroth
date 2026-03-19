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
  title: "Shadow Azeroth - Servidor WoW 3.3.5a WotLK High Rate",
  description: "Únete a la mejor comunidad de Wrath of the Lich King. Experiencia 3.3.5a estable, eventos únicos y comunidad activa en español e inglés. Proyecto educativo basado en emulación de código abierto (AzerothCore). Latencia baja desde Bolivia/Latam, scripts personalizados y hardware optimizado.",
  keywords: "WoW, World of Warcraft, Shadow Azeroth, WotLK, 3.3.5a, Servidor Privado, MMORPG, AzerothCore, High Rate, Comunidad, Latencia Baja, Bolivia, Latinoamérica, Español, Inglés, Eventos, Scripts Personalizados, Hardware Optimizado",
  authors: [{ name: "Shadow Azeroth Team" }],
  creator: "Shadow Azeroth Team",
  openGraph: {
    title: "Shadow Azeroth - Servidor WoW 3.3.5a WotLK High Rate",
    description: "Comunidad activa, experiencia estable, eventos únicos y soporte multilingüe. Proyecto educativo basado en AzerothCore.",
    type: "website",
    locale: "es_ES",
    siteName: "SHADOW AZEROTH",
    url: "https://shadowazeroth.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shadow Azeroth - Servidor WoW 3.3.5a WotLK High Rate",
    description: "Únete a la mejor comunidad de WotLK. Proyecto educativo, experiencia estable, eventos únicos.",
    creator: "@shadowazeroth",
  },
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
        <main className="flex-grow overflow-hidden w-full max-w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
