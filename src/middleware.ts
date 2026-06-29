import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const publicRoutes = createRouteMatcher([
  "/",
  "/warning-wizard(.*)",
  "/api/lost-pets-map(.*)",
  "/api/lost-pet-photos(.*)",
  "/api/lost-pet-save(.*)",
  "/api/found-pet-photos(.*)",
  "/api/found-pet-save(.*)",
]);

export default clerkMiddleware((auth, req) => {
  const pathname = req.nextUrl.pathname;
  const userAgent = req.headers.get("user-agent") ?? "";
  const isSmartphone =
    /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (!pathname.startsWith("/api") && isSmartphone && pathname !== "/warning-wizard") {
    return NextResponse.redirect(new URL("/warning-wizard", req.url));
  }

  if (!publicRoutes(req)) {
    auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
