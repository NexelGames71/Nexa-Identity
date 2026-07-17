# Admin Auth

Admin login uses Nexa Identity IAM. Admins are normal Nexa `User` records with hashed passwords plus an active `AdminRole`. When Supabase is configured, the same account is also created in Supabase Auth and linked through `supabaseAuthUserId`.

Routes:

- `POST /admin/api/auth/login`
- `POST /admin/api/auth/logout`
- `GET /admin/api/auth/me`

Admins can sign in with either their account email, such as `admin@admin.nexaidentity.com`, or their username, such as `admin.nexaidentity.com`.

For local role testing, run:

```powershell
cd "C:\Nexa Identity"
$env:ADMIN_TEST_PASSWORD="replace-with-a-local-test-password"
npm.cmd run identity:seed-admin-tests
```

Admin sessions are stored separately in `AdminSession`, hashed by token, and expire according to `ADMIN_SESSION_EXPIRES_IN`.

Admin login is protected by a stricter rate limit than general API traffic. Failed password attempts increment the normal user lockout counters, so admin IAM follows the same account safety posture as user login.

Do not create admin credential files. Do not store admin passwords outside the normal user table.
