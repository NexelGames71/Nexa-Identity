# Account Dashboard

The MVP dashboard is served from `GET /account`.

It calls the Nexa Identity APIs with a bearer access token and includes:

- Profile
- Security
- Devices
- Sessions
- Permissions
- Subscriptions
- API keys
- Organizations
- Data & Privacy

The dashboard is not Nexa Browser UI and is not Nexa AI UI. It is an account-management surface for Nexa Identity.

Account deletion is request-based and requires admin review. This avoids silent destructive account removal.
