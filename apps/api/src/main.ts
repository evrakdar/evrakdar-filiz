import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { getJwtSecret } from "./auth/auth.config";
import { isAcceptedHost } from "./auth/install-mode";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3002"
];

type ApiRequest = { headers: { host?: string } };
type ApiResponse = { statusCode: number; setHeader(name: string, value: string): void; end(): void };

async function bootstrap() {
  // Fail fast when production secrets are missing.
  getJwtSecret();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.API_PORT ?? 3001);

  // Only trust X-Forwarded-For when explicitly running behind a proxy (e.g. TRUST_PROXY=1).
  if (process.env.TRUST_PROXY) {
    const value = process.env.TRUST_PROXY;
    app.set("trust proxy", /^\d+$/.test(value) ? Number(value) : value);
  }

  app.disable("x-powered-by");
  app.use((request: ApiRequest, response: ApiResponse, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox");

    if (!isAcceptedHost(request.headers.host)) {
      response.statusCode = 403;
      response.end();
      return;
    }

    next();
  });

  app.enableCors({
    origin: getCorsOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
    credentials: true
  });

  await app.listen(port);
}

function getCorsOrigins() {
  const configured = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_CORS_ORIGINS;
}

void bootstrap();
