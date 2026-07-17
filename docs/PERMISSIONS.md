# Permissions

Permissions are user-granted access controls, not paid plan state.

Examples:

- `browser.read_current_page`
- `browser.read_all_tabs`
- `browser.open_tabs`
- `browser.navigate`
- `ai.memory_enabled`
- `ai.training_opt_in`
- `cloud.storage.read`
- `guardian.scan_links`

Sensitive defaults are false. Products must check permissions before exposing private user data or executing browser workflows.
