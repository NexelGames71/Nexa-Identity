# Nexa Browser Integration

Nexa Browser should work without login for basic browsing.

Login is required for synced features, Nexa AI account features, subscriptions, memory, cloud features, and device/session controls.

Recommended calls:

1. `POST /v1/auth/login`
2. Use the `HttpOnly` cookies set by Nexa Identity for web sessions, or store tokens using the browser's secure storage for native browser surfaces.
3. `GET /v1/auth/me`
4. `GET /v1/entitlements`
5. `GET /v1/permissions`
6. `GET /v1/devices`
7. `POST /v1/auth/refresh` when access tokens expire.

For a single browser bootstrap response, call `GET /v1/integrations/browser/bootstrap`.

High-risk browser actions such as submitting forms, payments, messages, or account changes require explicit user approval in the browser UI.

For implementation details and service middleware patterns, see `docs/CODEX_SERVICE_INTEGRATION_GUIDE.md`.
