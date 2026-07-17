# Admin Security

The admin dashboard uses Nexa Identity IAM. Admins are normal users with active `AdminRole` records; passwords are hashed by the normal authentication system.

Security rules:

- No static admin credential file.
- No plain-text admin passwords.
- Admin sessions are separate from normal sessions.
- Admin sessions are short-lived and revocable.
- Admin login has a stricter rate limit than general API traffic.
- Failed admin password attempts update IAM lockout counters.
- Every protected route checks backend RBAC.
- The UI hides nothing that the backend does not also enforce.
- Sensitive data is excluded from admin responses.
- Local access is gated by `ADMIN_DASHBOARD_ENABLED`, `ADMIN_ALLOWED_IPS`, and optional HTTPS enforcement.
- For Vercel production, keep `ADMIN_DASHBOARD_ENABLED=false` until admin access is protected by HTTPS, IAM, RBAC, and a verified IP allowlist.

Current audit coverage includes admin login, failed login, logout, user detail views, audit log views, admin role management, entitlement changes, permission changes, beta changes, email actions, API key revocation, and session revocation. New destructive admin actions must add audit logs before they are considered complete.
