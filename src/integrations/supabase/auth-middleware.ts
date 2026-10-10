import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabase } from "./client";

function decodeSessionToken(authHeader: string): { id: string; email: string } | null {
  try {
    const cleanToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const raw = typeof atob !== "undefined"
      ? atob(cleanToken)
      : Buffer.from(cleanToken, "base64").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed?.userId) return null;
    return { id: parsed.userId, email: parsed.email || "" };
  } catch {
    return null;
  }
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    const user = decodeSessionToken(authHeader);
    if (!user) {
      throw new Error("Unauthorized: Invalid session");
    }

    return next({
      context: {
        supabase,
        userId: user.id,
        claims: { sub: user.id, email: user.email },
      },
    });
  }
);
