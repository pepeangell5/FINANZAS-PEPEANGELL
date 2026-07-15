export const APP_BASE_PATH = "/finanzas";

export function withBasePath(path: string) {
  if (!path || path === "/") return APP_BASE_PATH;
  return `${APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export const BRAND_MASCOT = withBasePath("/assets/mascot-neon.png");
export const BRAND_MASCOT_LIGHT = withBasePath("/assets/mascot-classic.png");
