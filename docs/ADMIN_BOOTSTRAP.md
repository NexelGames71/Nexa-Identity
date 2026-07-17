# Admin Bootstrap

Create the first owner locally with:

```bash
npm run identity:create-owner
```

Bootstrap rules:

- `ALLOW_OWNER_BOOTSTRAP=true` is required.
- If an owner already exists, the command exits without creating another owner.
- In production, pass `--token=<OWNER_BOOTSTRAP_TOKEN>`.
- The owner password is hashed with the normal password hashing service.
- The owner is a real Nexa Identity user with an `owner` admin role.

Disable `ALLOW_OWNER_BOOTSTRAP` after creating the first owner.
