# Admin Audit Logs

Audit logs are append-only operational records for identity and admin activity.

Current admin events:

- `admin.logged_in`
- `admin.logged_out`
- `admin.failed_login`
- `admin.assigned_admin_role`
- `admin.updated_admin_role`
- `admin.revoked_admin_role`
- `admin.viewed_user`
- `admin.viewed_audit_logs`
- `admin.updated_user`
- `admin.disabled_user`
- `admin.enabled_user`
- `admin.revoked_session`
- `admin.revoked_all_sessions`
- `admin.updated_entitlement`
- `admin.disabled_entitlement`
- `admin.updated_permission`
- `admin.reset_permission`
- `admin.updated_beta_status`
- `admin.created_beta_invite`
- `admin.sent_verification_email`
- `admin.sent_password_reset`
- `admin.sent_beta_invite`
- `admin.revoked_api_key`
- `admin.owner_bootstrapped`

The admin API exposes `GET /admin/api/audit-logs` for authorized admins with `admin.audit.view`.

Do not add delete or mutation routes for audit logs. Export support can be added later behind `admin.audit.export`.
