import { getSupabaseConfig } from "../config/supabase.js";

type SupabaseAdminUserResponse = {
  id?: string;
  email?: string;
  user?: {
    id?: string;
    email?: string;
  };
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

export type SupabaseAuthUser = {
  id: string;
  email: string;
};

function requireSupabaseAdminConfig() {
  const config = getSupabaseConfig();
  if (!config.url || !config.secretKey) {
    throw new Error("Supabase Auth admin API is not configured.");
  }

  return {
    baseUrl: config.url.replace(/\/$/, ""),
    secretKey: config.secretKey
  };
}

async function readSupabaseResponse(response: Response): Promise<SupabaseAdminUserResponse> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as SupabaseAdminUserResponse;
  } catch {
    return { message: text };
  }
}

function supabaseErrorMessage(payload: SupabaseAdminUserResponse) {
  return payload.error_description ?? payload.message ?? payload.msg ?? payload.error ?? "Supabase Auth request failed.";
}

function normalizeCreatedUser(payload: SupabaseAdminUserResponse, email: string): SupabaseAuthUser {
  const user = payload.user ?? payload;
  if (!user.id) {
    throw new Error("Supabase Auth did not return a user id.");
  }

  return {
    id: user.id,
    email: user.email ?? email
  };
}

export async function createSupabaseAuthUser(params: {
  email: string;
  password: string;
  displayName: string;
  username: string;
  emailConfirmed?: boolean;
}) {
  const config = requireSupabaseAdminConfig();
  const response = await fetch(`${config.baseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: config.secretKey,
      authorization: `Bearer ${config.secretKey}`
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: params.emailConfirmed ?? false,
      user_metadata: {
        display_name: params.displayName,
        username: params.username,
        provider: "nexa_identity"
      },
      app_metadata: {
        source: "nexa_identity"
      }
    })
  });

  const payload = await readSupabaseResponse(response);
  if (!response.ok) {
    throw new Error(supabaseErrorMessage(payload));
  }

  return normalizeCreatedUser(payload, params.email);
}

export async function deleteSupabaseAuthUser(userId: string) {
  const config = requireSupabaseAdminConfig();
  const response = await fetch(`${config.baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: config.secretKey,
      authorization: `Bearer ${config.secretKey}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const payload = await readSupabaseResponse(response);
    throw new Error(supabaseErrorMessage(payload));
  }
}
