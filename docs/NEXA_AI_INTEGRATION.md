# Nexa AI Integration

Nexa AI must not own user authentication.

Nexa AI backend should:

1. Accept an access token from the client.
2. Validate it locally using the shared token secret or call `POST /v1/auth/verify-token`.
3. Load user profile, plan, permissions, memory settings, and training consent from Nexa Identity.
4. Treat missing or expired tokens as guest/unauthenticated state.

Memory and training opt-in must remain disabled unless explicit permissions allow them.

For a single account context response, call `GET /v1/integrations/nexa-ai/context`.

For implementation details and service middleware patterns, see `docs/CODEX_SERVICE_INTEGRATION_GUIDE.md`.
