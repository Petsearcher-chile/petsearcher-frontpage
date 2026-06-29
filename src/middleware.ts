import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveSupportedLocale } from "@/i18n/locales";

const publicRoutes = createRouteMatcher([
  "/",
  "/movil(.*)",
  "/warning-wizard(.*)",
  "/api/lost-pets-map(.*)",
  "/api/lost-pet-photos(.*)",
  "/api/lost-pet-save(.*)",
  "/api/found-pet-photos(.*)",
  "/api/found-pet-save(.*)",
]);

export default clerkMiddleware((auth, req) => {
  const pathname = req.nextUrl.pathname;
  const searchLocale = resolveSupportedLocale(req.nextUrl.searchParams.get("locale"));
  const userAgent = req.headers.get("user-agent") ?? "";
  const isSmartphone =
    /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (!pathname.startsWith("/api") && isSmartphone && pathname !== "/movil") {
    return NextResponse.redirect(new URL("/movil", req.url));
  }

  if (!publicRoutes(req)) {
    auth.protect();
  }

  if (searchLocale) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-locale", searchLocale);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.cookies.set("locale", searchLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
