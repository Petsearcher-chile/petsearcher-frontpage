import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import BrowserLanguageLogger from "./browser-language-logger";
import "./globals.css";
import { getIntl } from "@/i18n/get-intl";
import enMessages from "@/messages/en.json";
import {
  AVAILABLE_LOCALES,
  formatHreflangLocale,
  formatOpenGraphLocale,
} from "@/i18n/locales";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const metadataBase = new URL(siteUrl);

type SeoMessages = {
  title: string;
  description: string;
  keywords: string[];
};

const buildLanguageAlternates = () =>
  Object.fromEntries(
    AVAILABLE_LOCALES.map((locale) => [formatHreflangLocale(locale), `/?locale=${locale}`]),
  );

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getIntl();
  const seo = (messages as typeof enMessages & { SEO: SeoMessages }).SEO;
  const localeUrl = new URL(`/?locale=${locale}`, metadataBase).toString();
  const localeAlternates = AVAILABLE_LOCALES.filter((availableLocale) => availableLocale !== locale)
    .map((availableLocale) => formatOpenGraphLocale(availableLocale));

  return {
    metadataBase,
    title: seo.title,
    description: seo.description,
    applicationName: "PetSearcher",
    creator: "PetSearcher",
    publisher: "PetSearcher",
    category: "Animals",
    keywords: seo.keywords,
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
      title: seo.title,
      description: seo.description,
    },
    twitter: {
      card: "summary",
      title: seo.title,
      description: seo.description,
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
