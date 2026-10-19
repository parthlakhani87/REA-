// Public address of the app, used for share links and link previews.
// Set APP_URL (e.g. https://connect.pongs.in) to override; on Vercel the production domain is used automatically.
export function siteUrl() {
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:3000";
}
