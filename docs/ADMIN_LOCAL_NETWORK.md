# Admin Local Network Access

The admin dashboard is disabled by default. Enable it only for trusted local development:

```env
ADMIN_DASHBOARD_ENABLED=true
ADMIN_ALLOW_LAN=false
ADMIN_ALLOWED_IPS=127.0.0.1,::1
ADMIN_REQUIRE_HTTPS=false
```

Default behavior allows loopback access only. To test from another device on a trusted LAN, set `ADMIN_ALLOW_LAN=true` and add the exact client IP to `ADMIN_ALLOWED_IPS`.

LAN mode never bypasses IAM login, admin sessions, or RBAC. Keep `ADMIN_REQUIRE_HTTPS=true` for any hosted or tunneled deployment.
