import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppRole = "admin" | "user";

export type AdminContext = {
  currentUser: User;
  supabaseAdmin: SupabaseClient;
};

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function getRole(user: User): AppRole {
  return user.app_metadata?.role === "admin" ? "admin" : "user";
}

export function isActiveUser(user: User) {
  if (!user.banned_until) {
    return true;
  }

  return new Date(user.banned_until).getTime() <= Date.now();
}

export async function requireAdmin(request: Request): Promise<
  | { context: AdminContext; response?: never }
  | { context?: never; response: Response }
> {
  let supabaseAdmin: SupabaseClient;

  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch {
    return {
      response: jsonError(
        "Falta configurar SUPABASE_SECRET_KEY en el servidor.",
        500,
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return { response: jsonError("Sesión no válida.", 401) };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { response: jsonError("Sesión no válida.", 401) };
  }

  if (getRole(user) !== "admin") {
    return { response: jsonError("No tienes permiso de administrador.", 403) };
  }

  return {
    context: {
      currentUser: user,
      supabaseAdmin,
    },
  };
}
