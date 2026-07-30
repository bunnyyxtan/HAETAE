// Vercel serverless entry. @vercel/node accepts an exported Express app as
// the request handler; vercel.json rewrites every /api/* request here with
// the original URL intact, so the app's /api router matches unchanged.
// Static files (the console SPA) are served by Vercel's CDN from the web
// build output, not by this function.
import app from "../server/app.js";

export default app;
