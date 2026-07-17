# Admin RBAC

Implemented MVP roles:

- `owner`: all permissions.
- `admin`: broad access except owner/admin management.
- `support`: view users/sessions/beta status and send predefined account emails.
- `security`: view audit/user/session/device data and revoke suspicious sessions.

Backend routes must enforce permissions with admin middleware. Frontend hiding is not considered authorization.

Admin role management requires `admin.admins.manage`, which is available to owners by default. The backend refuses to revoke or demote the last active owner admin.
