# Auth Flow

1. User registers with email, username, password, and display name.
2. Nexa Identity hashes the password, creates the profile, default permissions, and default entitlements.
3. Nexa Identity creates a one-time email verification token. In production this should be delivered by the configured email provider.
4. User logs in with email or username.
5. Nexa Identity returns an access token, refresh token, user profile, entitlements, and basic settings.
6. Login and refresh responses also set `HttpOnly` cookies for browser-based clients.
7. Access tokens are used as `Authorization: Bearer <token>` or from the `nexa_access_token` cookie.
8. Refresh tokens are rotated on `/v1/auth/refresh`.
9. Logout revokes the refresh-token session.

Refresh tokens are never stored in plain text.
