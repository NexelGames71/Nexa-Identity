import { Router } from "express";

export const adminDashboardRouter = Router();

adminDashboardRouter.get(["/admin", "/admin/"], (_req, res) => {
  const cspNonce = res.locals.cspNonce;
  res
    .set({
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache"
    })
    .type("html")
    .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nexa Identity Admin</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080b10; color: #eef3ff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #080b10; }
    button, input, select { font: inherit; }
    button { border: 1px solid rgba(255,255,255,.14); color: #eef3ff; background: rgba(255,255,255,.07); border-radius: 8px; padding: 10px 12px; cursor: pointer; }
    button:hover { background: rgba(255,255,255,.12); }
    input, select { width: 100%; border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.24); color: #eef3ff; border-radius: 8px; padding: 10px 12px; }
    .layout { display: grid; min-height: 100vh; grid-template-columns: 260px 1fr; }
    aside { border-right: 1px solid rgba(255,255,255,.1); background: #0d1118; padding: 20px; }
    main { padding: 22px; display: grid; gap: 18px; align-content: start; }
    h1 { margin: 0 0 18px; font-size: 19px; letter-spacing: 0; }
    h2 { margin: 0; font-size: 18px; letter-spacing: 0; }
    nav { display: grid; gap: 8px; }
    nav button { text-align: left; }
    .topbar, .toolbar, .login { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .login { min-height: 100vh; justify-content: center; padding: 24px; }
    .login form { width: min(420px, 100%); display: grid; gap: 12px; border: 1px solid rgba(255,255,255,.11); border-radius: 8px; padding: 22px; background: #0d1118; }
    .panel { display: grid; gap: 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 16px; background: rgba(255,255,255,.035); }
    .metrics { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; }
    .metric { border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 14px; background: rgba(255,255,255,.04); }
    .metric strong { display: block; font-size: 24px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid rgba(255,255,255,.08); vertical-align: top; }
    th { color: #aeb9cd; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    pre { white-space: pre-wrap; overflow: auto; margin: 0; padding: 12px; border-radius: 8px; background: rgba(0,0,0,.28); color: #dbe5ff; }
    .muted { color: #9ca8c0; font-size: 13px; }
    .split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .danger { border-color: rgba(255, 77, 109, .45); background: rgba(255, 77, 109, .16); }
    .hidden { display: none !important; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } aside { position: static; } .metrics, .split { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { main { padding: 14px; } .metrics { grid-template-columns: 1fr; } th:nth-child(4), td:nth-child(4) { display: none; } }
  </style>
</head>
<body>
  <section id="loginShell" class="login">
    <form onsubmit="signIn(event)">
      <h1>Nexa Identity Admin</h1>
      <label>Email or username <input id="identifier" type="text" autocomplete="username" required /></label>
      <label>Password <input id="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">Sign in</button>
      <p id="loginMessage" class="muted"></p>
    </form>
  </section>
  <section id="app" class="layout hidden">
    <aside>
      <h1>Nexa Admin</h1>
      <nav>
        <button onclick="show('overview')">Overview</button>
        <button onclick="show('users')">Users</button>
        <button onclick="show('beta')">Beta Access</button>
        <button onclick="show('emailTools')">Email Tools</button>
        <button onclick="show('audit')">Audit Logs</button>
        <button onclick="show('apiKeys')">API Keys</button>
        <button onclick="show('organizations')">Organizations</button>
        <button onclick="show('system')">System Health</button>
        <button onclick="show('admins')">Admins</button>
        <button onclick="show('settings')">Admin Settings</button>
      </nav>
    </aside>
    <main>
      <div class="topbar"><strong id="adminName"></strong><span id="adminRole" class="muted"></span><button onclick="logout()">Logout</button></div>
      <section id="overview" class="panel"></section>
      <section id="users" class="panel hidden">
        <h2>Users</h2>
        <div class="toolbar"><input id="userSearch" placeholder="Search email, username, name, or ID" /><button onclick="loadUsers()">Search</button></div>
        <div id="usersOut"></div>
        <div id="userDetail"></div>
      </section>
      <section id="beta" class="panel hidden"><h2>Beta Access</h2><div id="betaOut"></div></section>
      <section id="emailTools" class="panel hidden">
        <h2>Email Tools</h2>
        <div class="toolbar"><input id="emailUserId" placeholder="Target user ID" /><button onclick="sendVerification()">Send verification</button><button onclick="sendPasswordReset()">Send password reset</button><button onclick="sendBetaInvite()">Send beta invite</button></div>
        <pre id="emailOut"></pre>
      </section>
      <section id="audit" class="panel hidden"><h2>Audit Logs</h2><div id="auditOut"></div></section>
      <section id="apiKeys" class="panel hidden"><h2>API Keys</h2><div id="apiKeysOut"></div></section>
      <section id="organizations" class="panel hidden"><h2>Organizations</h2><div id="organizationsOut"></div></section>
      <section id="system" class="panel hidden"><h2>System Health</h2><pre id="systemOut"></pre></section>
      <section id="admins" class="panel hidden">
        <h2>Admins</h2>
        <div class="toolbar"><input id="adminUserId" placeholder="User ID" /><select id="adminRoleSelect"><option>support</option><option>security</option><option>admin</option><option>owner</option><option>billing</option><option>developer</option></select><button onclick="assignAdminRole()">Assign role</button></div>
        <div id="adminsOut"></div>
      </section>
      <section id="settings" class="panel hidden"><h2>Admin Settings</h2><pre id="settingsOut"></pre></section>
    </main>
  </section>
  <script nonce="${cspNonce}">
    const sections = ["overview", "users", "beta", "emailTools", "audit", "apiKeys", "organizations", "system", "admins", "settings"];
    let currentUserId = "";
    async function request(path, options = {}) {
      const response = await fetch("/admin/api" + path, { credentials: "include", ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message || "Request failed");
      return body.data;
    }
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
    }
    function show(id) {
      sections.forEach((section) => document.getElementById(section).classList.toggle("hidden", section !== id));
      if (id === "audit") loadAudit();
      if (id === "apiKeys") loadApiKeys();
      if (id === "organizations") loadOrganizations();
      if (id === "beta") loadBeta();
      if (id === "system") loadSystem();
      if (id === "admins") loadAdmins();
      if (id === "settings") loadSettings();
    }
    async function signIn(event) {
      event.preventDefault();
      try {
        loginMessage.textContent = "Signing in...";
        await request("/auth/login", { method: "POST", body: JSON.stringify({ identifier: identifier.value, password: password.value }) });
        history.replaceState(null, "", "/admin#overview");
        await boot();
      } catch (error) { loginMessage.textContent = error.message; }
    }
    async function logout() { await request("/auth/logout", { method: "POST" }); location.reload(); }
    async function boot() {
      const me = await request("/auth/me");
      loginShell.classList.add("hidden");
      app.classList.remove("hidden");
      adminName.textContent = me.admin.displayName || me.admin.email;
      adminRole.textContent = me.admin.role;
      await loadOverview();
      await loadUsers();
    }
    async function loadOverview() {
      const data = await request("/overview");
      const metrics = Object.entries(data.stats).map(([key, value]) => '<div class="metric"><span class="muted">' + escapeHtml(key) + '</span><strong>' + value + '</strong></div>').join("");
      overview.innerHTML = '<h2>Overview</h2><div class="metrics">' + metrics + '</div><h2>Recent audit events</h2>' + table(data.recentAuditEvents, ["createdAt","action","resourceType","resourceId"]);
    }
    async function loadUsers() {
      const q = encodeURIComponent(userSearch.value.trim());
      const data = await request("/users" + (q ? "?q=" + q : ""));
      usersOut.innerHTML = table(data.users, ["email","username","displayName","status","emailVerified","createdAt"], (user) => '<button onclick="loadUserDetail(\\'' + user.id + '\\')">Open</button>');
    }
    async function loadUserDetail(id) {
      currentUserId = id;
      emailUserId.value = id;
      const [{ user }, sessions, devices, entitlements, permissions, apiKeys] = await Promise.all([
        request("/users/" + id),
        request("/users/" + id + "/sessions"),
        request("/users/" + id + "/devices"),
        request("/users/" + id + "/entitlements"),
        request("/users/" + id + "/permissions"),
        request("/users/" + id + "/api-keys")
      ]);
      userDetail.innerHTML = '<h2>User Detail</h2><div class="actions"><button onclick="enableUser()">Enable</button><button class="danger" onclick="disableUser()">Disable</button><button onclick="addBetaAccess()">Add beta</button><button onclick="resetPermissions()">Reset permissions</button></div><pre>' + escapeHtml(JSON.stringify(user, null, 2)) + '</pre><h2>Entitlements</h2><div class="toolbar"><select id="entProduct"><option>nexa_ai</option><option>nexa_browser</option><option>nexa_cloud</option><option>nexa_storage</option><option>nexa_database</option><option>nexa_ide</option><option>nexa_gpu</option></select><select id="entPlan"><option>free</option><option>plus</option><option>pro</option><option>premium</option><option>business</option><option>beta</option><option>internal</option><option>disabled</option></select><button onclick="grantEntitlement()">Grant/update</button></div>' + table(entitlements.entitlements, ["productId","plan","status","expiresAt","updatedAt"], (entitlement) => '<button class="danger" onclick="disableEntitlement(\\'' + entitlement.id + '\\')">Disable</button>') + '<h2>Permissions</h2>' + table(permissions.permissions, ["scope","value","source","updatedAt"], (permission) => '<button onclick="setPermission(\\'' + permission.scope + '\\',' + (!permission.value) + ')">' + (permission.value ? "Disable" : "Enable") + '</button>') + '<h2>Sessions</h2>' + table(sessions.sessions, ["id","ipAddress","expiresAt","revokedAt","createdAt"], (session) => session.revokedAt ? "" : '<button onclick="revokeSession(\\'' + id + '\\',\\'' + session.id + '\\')">Revoke</button>') + '<h2>Devices</h2>' + table(devices.devices, ["deviceName","platform","browser","trusted","lastActiveAt"]) + '<h2>API Keys</h2>' + table(apiKeys.apiKeys, ["name","prefix","lastUsedAt","expiresAt","revokedAt"], (key) => key.revokedAt ? "" : '<button class="danger" onclick="revokeApiKey(\\'' + key.id + '\\')">Revoke</button>');
    }
    function reason() { const value = prompt("Reason for audit log"); if (!value || value.length < 3) throw new Error("A reason is required."); return value; }
    async function revokeSession(userId, sessionId) { await request("/users/" + userId + "/sessions/" + sessionId + "/revoke", { method: "POST" }); await loadUserDetail(userId); }
    async function enableUser() { await request("/users/" + currentUserId + "/enable", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadUserDetail(currentUserId); await loadUsers(); }
    async function disableUser() { await request("/users/" + currentUserId + "/disable", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadUserDetail(currentUserId); await loadUsers(); }
    async function grantEntitlement() { await request("/users/" + currentUserId + "/entitlements", { method: "POST", body: JSON.stringify({ productId: entProduct.value, plan: entPlan.value, status: entPlan.value === "disabled" ? "disabled" : "active", reason: reason() }) }); await loadUserDetail(currentUserId); }
    async function disableEntitlement(id) { await request("/users/" + currentUserId + "/entitlements/" + id + "/disable", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadUserDetail(currentUserId); }
    async function setPermission(scope, value) { await request("/users/" + currentUserId + "/permissions/" + encodeURIComponent(scope), { method: "PATCH", body: JSON.stringify({ value, reason: reason() }) }); await loadUserDetail(currentUserId); }
    async function resetPermissions() { await request("/users/" + currentUserId + "/permissions/reset", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadUserDetail(currentUserId); }
    async function addBetaAccess() { await request("/beta/users/" + currentUserId + "/add", { method: "POST", body: JSON.stringify({ products: ["nexa_ai","nexa_browser"], betaStatus: "active", testerType: "public_beta", reason: reason() }) }); await loadUserDetail(currentUserId); await loadBeta(); }
    async function revokeApiKey(id) { await request("/api-keys/" + id + "/revoke", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadUserDetail(currentUserId); await loadApiKeys(); }
    async function loadAudit() { const data = await request("/audit-logs"); auditOut.innerHTML = table(data.logs, ["createdAt","action","resourceType","resourceId","ipAddress"]); }
    async function loadApiKeys() { const data = await request("/api-keys"); apiKeysOut.innerHTML = table(data.apiKeys, ["name","prefix","userId","lastUsedAt","expiresAt","revokedAt"], (key) => key.revokedAt ? "" : '<button class="danger" onclick="revokeApiKeyFromList(\\'' + key.id + '\\')">Revoke</button>'); }
    async function revokeApiKeyFromList(id) { await request("/api-keys/" + id + "/revoke", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadApiKeys(); }
    async function loadOrganizations() { const data = await request("/organizations"); organizationsOut.innerHTML = table(data.organizations, ["name","slug","plan","status","createdAt"]); }
    async function loadBeta() { const data = await request("/beta/users"); betaOut.innerHTML = table(data.betaUsers, ["userId","products","betaStatus","testerType","updatedAt"], (beta) => '<button class="danger" onclick="removeBeta(\\'' + beta.userId + '\\')">Remove</button>'); }
    async function removeBeta(id) { await request("/beta/users/" + id + "/remove", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadBeta(); if (currentUserId === id) await loadUserDetail(id); }
    async function sendVerification() { emailOut.textContent = JSON.stringify(await request("/email/" + emailUserId.value + "/send-verification", { method: "POST" }), null, 2); }
    async function sendPasswordReset() { emailOut.textContent = JSON.stringify(await request("/email/" + emailUserId.value + "/send-password-reset", { method: "POST" }), null, 2); }
    async function sendBetaInvite() { emailOut.textContent = JSON.stringify(await request("/email/" + emailUserId.value + "/send-beta-invite", { method: "POST" }), null, 2); }
    async function loadSystem() { systemOut.textContent = JSON.stringify(await request("/system/health"), null, 2); }
    async function loadAdmins() { const data = await request("/admins"); adminsOut.innerHTML = table(data.admins, ["id","userId","role","createdAt"], (role) => '<button class="danger" onclick="revokeAdminRole(\\'' + role.id + '\\')">Revoke</button>'); }
    async function assignAdminRole() { await request("/admins", { method: "POST", body: JSON.stringify({ userId: adminUserId.value, role: adminRoleSelect.value, reason: reason() }) }); await loadAdmins(); }
    async function revokeAdminRole(id) { await request("/admins/" + id + "/revoke", { method: "POST", body: JSON.stringify({ reason: reason() }) }); await loadAdmins(); }
    async function loadSettings() { settingsOut.textContent = JSON.stringify(await request("/settings"), null, 2); }
    function table(rows, keys, action) {
      if (!rows.length) return '<p class="muted">No records found.</p>';
      return '<table><thead><tr>' + keys.map((key) => '<th>' + escapeHtml(key) + '</th>').join("") + (action ? '<th>Action</th>' : '') + '</tr></thead><tbody>' + rows.map((row) => '<tr>' + keys.map((key) => '<td>' + escapeHtml(row[key]) + '</td>').join("") + (action ? '<td>' + action(row) + '</td>' : '') + '</tr>').join("") + '</tbody></table>';
    }
    boot().catch(() => {});
  </script>
</body>
</html>`);
});
