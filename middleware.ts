import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);
const isHomePage = createRouteMatcher(["/"]);
const isProtectedRoute = createRouteMatcher(["/server", "/admin(.*)"]); // '/' no longer protected

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Always land home ('/') on the scanner page
  if (isHomePage(request)) {
    return nextjsMiddlewareRedirect(request, "/scan");
  }

  // If user is signed in and visits sign-in, send them to admin
  if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/admin");
  }

  // Protect admin and server routes
  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
