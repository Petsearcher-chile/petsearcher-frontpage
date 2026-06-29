import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import BrowserLanguageLogger from "./browser-language-logger";
import "./globals.css";
import { getIntl } from "@/i18n/get-intl";
import { AVAILABLE_LOCALES, formatHreflangLocale, formatOpenGraphLocale } from "@/i18n/locales";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_DESCRIPTION =
  "PetSearcher es una plataforma para publicar, buscar y encontrar mascotas perdidas o encontradas en cualquier lugar.";
const BASE_KEYWORDS = [
  "PetSearcher",
  "PetSearcher app",
  "PetSearcher website",
  "PetSearcher platform",
  "pet searcher",
  "mascotas perdidas",
  "mascotas encontradas",
  "mascotas desaparecidas",
  "mascotas perdidas y encontradas",
  "buscar mascotas perdidas",
  "buscar mascotas encontradas",
  "encontrar mascotas perdidas",
  "encontrar mascotas encontradas",
  "publicar mascota perdida",
  "publicar mascota encontrada",
  "avisos de mascotas",
  "alertas de mascotas",
  "aviso de mascota perdida",
  "aviso de mascota encontrada",
  "alerta de mascota perdida",
  "alerta de mascota encontrada",
  "perros perdidos",
  "perros encontrados",
  "perro perdido",
  "perro encontrado",
  "gatos perdidos",
  "gatos encontrados",
  "gato perdido",
  "gato encontrado",
  "animales perdidos",
  "animales encontrados",
  "rescate de mascotas",
  "rescate de animales",
  "ayuda mascotas perdidas",
  "ayuda a encontrar mascotas",
  "recuperar mascota perdida",
  "buscar mi mascota",
  "perdi mi mascota",
  "se perdió mi mascota",
  "se perdió mi perro",
  "se perdió mi gato",
  "lost pet",
  "lost pets",
  "lost dog",
  "lost cat",
  "found pet",
  "found pets",
  "pet finder",
  "pet finder app",
  "lost and found pets",
  "missing pet",
  "missing pets",
  "dog lost",
  "cat lost",
  "dog found",
  "cat found",
  "alerta de mascotas",
  "mapa de mascotas",
  "mapa de mascotas perdidas",
  "mapa de mascotas encontradas",
  "mapa de animales perdidos",
  "mapa de animales encontrados",
  "reporte de mascota perdida",
  "reporte de mascota encontrada",
  "reporte de animal perdido",
  "reporte de animal encontrado",
];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const metadataBase = new URL(siteUrl);

const buildLanguageAlternates = () =>
  Object.fromEntries(
    AVAILABLE_LOCALES.map((locale) => [formatHreflangLocale(locale), `/?locale=${locale}`]),
  );

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getIntl();
  const localeUrl = new URL(`/?locale=${locale}`, metadataBase).toString();
  const localeAlternates = AVAILABLE_LOCALES.filter((availableLocale) => availableLocale !== locale)
    .map((availableLocale) => formatOpenGraphLocale(availableLocale));

  return {
    metadataBase,
    title: {
      default: "PetSearcher",
      template: "%s | PetSearcher",
    },
    description: BASE_DESCRIPTION,
    applicationName: "PetSearcher",
    creator: "PetSearcher",
    publisher: "PetSearcher",
    category: "Animals",
    keywords: BASE_KEYWORDS,
    alternates: {
      canonical: localeUrl,
      languages: {
        "x-default": "/",
        ...buildLanguageAlternates(),
      },
    },
    openGraph: {
      type: "website",
      locale: formatOpenGraphLocale(locale),
      alternateLocale: localeAlternates,
      url: localeUrl,
      siteName: "PetSearcher",
      title: "PetSearcher",
      description:
        "Busca y publica mascotas perdidas o encontradas con mapas, formularios y avisos claros.",
    },
    twitter: {
      card: "summary",
      title: "PetSearcher",
      description:
        "Plataforma para publicar, buscar y encontrar mascotas perdidas o encontradas.",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, messages } = await getIntl();

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClerkProvider>{children}</ClerkProvider>
        </NextIntlClientProvider>
        <BrowserLanguageLogger />
        <Analytics />
      </body>
    </html>
  );
}
