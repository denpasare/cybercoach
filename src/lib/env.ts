import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().min(1),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().min(1),
  AUTH_MICROSOFT_ENTRA_ID_TENANT_ID: z.string().min(1).default("common"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1, "TOKEN_ENCRYPTION_KEY is required (base64-encoded 32 bytes)"),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validate and return the server-side environment.
 *
 * We deliberately read process.env lazily so that build-time tooling
 * (Next.js page collection, etc.) doesn't blow up when env vars are
 * missing — instead failures happen at request time with a clear error.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment. Check your .env file:\n${issues}`,
    );
  }
  cached = parsed.data;
  return cached;
}
