import { getEnv } from "./env";

/**
 * Dev mode toggles a Microsoft-free shortcut path used purely for local
 * development and end-to-end testing.
 *
 * Hard rules:
 *  - The flag is read server-side only.
 *  - Production builds must set ENABLE_DEV_AUTH="false" (or leave it unset).
 *  - The dev signin route refuses to run when this flag is false.
 */
export function isDevModeEnabled(): boolean {
  try {
    return getEnv().ENABLE_DEV_AUTH === true;
  } catch {
    return false;
  }
}

export const DEV_USER = {
  email: "dev@emailyzer.local",
  name: "Dev User",
} as const;
