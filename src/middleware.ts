import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const publicRoutes = createRouteMatcher([
  "/",
  "/api/lost-pets-map(.*)",
  "/api/lost-pet-photos(.*)",
]);

export default clerkMiddleware((auth, req) => {
  // Clerk will automatically handle auth for non-public routes
  // Just check if it's public and do nothing if it is
  publicRoutes(req);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
