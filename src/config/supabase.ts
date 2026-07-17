import { env } from "./env.js";

export function getSupabaseConfig() {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY;
  const jwksUrl = env.SUPABASE_JWKS_URL || (url ? `${url.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json` : undefined);
  const authBaseUrl = url ? `${url.replace(/\/$/, "")}/auth/v1` : undefined;
  const oidcTokenEndpoint = env.SUPABASE_OIDC_TOKEN_ENDPOINT || (authBaseUrl ? `${authBaseUrl}/oauth/token` : undefined);
  const oidcAuthorizationEndpoint =
    env.SUPABASE_OIDC_AUTHORIZATION_ENDPOINT || (authBaseUrl ? `${authBaseUrl}/oauth/authorize` : undefined);
  const oidcDiscoveryUrl =
    env.SUPABASE_OIDC_DISCOVERY_URL || (authBaseUrl ? `${authBaseUrl}/.well-known/openid-configuration` : undefined);

  return {
    configured: Boolean(url && publishableKey),
    adminConfigured: Boolean(url && secretKey),
    url,
    publishableKey,
    secretKey,
    jwksUrl,
    oidcTokenEndpoint,
    oidcAuthorizationEndpoint,
    oidcDiscoveryUrl
  };
}
