export { default } from "next-auth/middleware";

export const config = {
  // Only protect the dashboard and its sub-routes
  matcher: ["/dashboard/:path*"],
};
