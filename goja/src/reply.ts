// Request and response shapes, and the five answers this plugin gives.

export interface Ctx {
  org: string; // the validated tenant, from the host. Never from the request.
  params: Record<string, string>;
}

export interface Res {
  status: number;
  body: unknown;
}

export const ok = (body: unknown): Res => ({ status: 200, body });

export const badReq = (message: string): Res => ({
  status: 400,
  body: { success: false, message },
});

export const notFound = (message: string, extra?: unknown): Res => ({
  status: 404,
  body: extra
    ? { success: false, message, ...(extra as Record<string, unknown>) }
    : { success: false, message },
});

// The plugin is read-only. Saying so beats a route that is merely absent.
export const readOnly = (message: string): Res => ({
  status: 405,
  body: { success: false, message, allow: "GET" },
});

// The host mounted the plugin without something it needs. This is a deployment
// fault, not a request fault, and it must never look like an empty answer.
export const unmounted = (message: string): Res => ({
  status: 501,
  body: { success: false, message },
});
