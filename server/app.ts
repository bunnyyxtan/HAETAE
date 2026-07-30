import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Behind the platform edge the X-Forwarded-For chain is set by the trusted
// proxy, so req.ip resolves to the real client for rate limiting.
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers: HSTS, nosniff, no framing, tight referrer.
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// No CORS middleware on purpose: the desk is called same-origin by our own
// frontend only; no cross-origin caller is legitimate.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// JSON error handler: body-parser and any other middleware errors must never
// fall through to Express's default HTML page (stack trace + absolute file
// paths). Terse JSON to the client; full detail server-side only.
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  logger.error({ err }, "request error");
  const status = typeof err.status === "number" ? err.status : 500;
  const error =
    err.type === "entity.too.large" ? "request body too large"
    : err.type === "entity.parse.failed" ? "malformed JSON body"
    : status < 500 ? "bad request"
    : "internal error";
  res.status(status).json({ error });
});

export default app;
