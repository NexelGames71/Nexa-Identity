import { Router } from "express";

export const dashboardRouter = Router();

dashboardRouter.get("/account", (_req, res) => {
  const cspNonce = res.locals.cspNonce;
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nexa Identity Account</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #090b10; color: #eef3ff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top left, rgba(42, 124, 255, .2), transparent 34rem), #090b10; }
    header { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid rgba(255,255,255,.1); background: rgba(9, 11, 16, .86); backdrop-filter: blur(18px); }
    .bar { max-width: 1180px; margin: 0 auto; padding: 18px 24px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    h1 { font-size: 20px; margin: 0; letter-spacing: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; display: grid; grid-template-columns: 240px 1fr; gap: 24px; }
    nav { display: grid; gap: 8px; align-self: start; position: sticky; top: 78px; }
    button, input, textarea { font: inherit; }
    button { border: 1px solid rgba(255,255,255,.14); color: #eef3ff; background: rgba(255,255,255,.07); border-radius: 8px; padding: 10px 12px; cursor: pointer; }
    button:hover { background: rgba(255,255,255,.12); }
    nav button { text-align: left; }
    .primary { background: #2f7cff; border-color: #2f7cff; }
    .danger { background: rgba(255, 72, 96, .18); border-color: rgba(255, 72, 96, .38); }
    .panel { display: none; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.055); border-radius: 8px; padding: 20px; }
    .panel.active { display: block; }
    h2 { margin: 0 0 16px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    label { display: grid; gap: 6px; color: #b9c4dc; font-size: 13px; }
    input, textarea { width: 100%; border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.24); color: #eef3ff; border-radius: 8px; padding: 10px 12px; }
    textarea { min-height: 96px; resize: vertical; }
    pre { white-space: pre-wrap; overflow: auto; padding: 14px; border-radius: 8px; background: rgba(0,0,0,.26); color: #d7e2ff; }
    .stack { display: grid; gap: 12px; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .muted { color: #9ca8c0; font-size: 13px; }
    @media (max-width: 760px) { main { grid-template-columns: 1fr; } nav { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <h1>Nexa Identity</h1>
      <div class="row">
        <input id="token" type="password" placeholder="Access token" aria-label="Access token" />
        <button class="primary" onclick="loadAccount()">Load</button>
      </div>
    </div>
  </header>
  <main>
    <nav>
      <button onclick="showPanel('profile')">Profile</button>
      <button onclick="showPanel('security')">Security</button>
      <button onclick="showPanel('devices')">Devices</button>
      <button onclick="showPanel('sessions')">Sessions</button>
      <button onclick="showPanel('permissions')">Permissions</button>
      <button onclick="showPanel('subscriptions')">Subscriptions</button>
      <button onclick="showPanel('apiKeys')">API Keys</button>
      <button onclick="showPanel('organizations')">Organizations</button>
      <button onclick="showPanel('privacy')">Data & Privacy</button>
    </nav>
    <section class="stack">
      <div id="profile" class="panel active">
        <h2>Profile</h2>
        <div class="grid">
          <label>Display name <input id="displayName" /></label>
          <label>Username <input id="username" /></label>
          <label>First name <input id="firstName" /></label>
          <label>Last name <input id="lastName" /></label>
          <label>Country <input id="country" /></label>
          <label>Timezone <input id="timezone" /></label>
          <label>Language <input id="language" /></label>
        </div>
        <label style="margin-top:12px">Bio <textarea id="bio"></textarea></label>
        <div class="row" style="margin-top:12px"><button class="primary" onclick="saveProfile()">Save profile</button><span id="emailStatus" class="muted"></span></div>
      </div>
      <div id="security" class="panel">
        <h2>Security</h2>
        <div class="grid">
          <label>Current password <input id="currentPassword" type="password" /></label>
          <label>New password <input id="newPassword" type="password" /></label>
        </div>
        <div class="row" style="margin-top:12px"><button class="primary" onclick="changePassword()">Change password</button><button class="danger" onclick="revokeAllSessions()">Sign out all devices</button></div>
      </div>
      <div id="devices" class="panel"><h2>Devices</h2><pre id="devicesOut">Load account to view devices.</pre></div>
      <div id="sessions" class="panel"><h2>Sessions</h2><pre id="sessionsOut">Load account to view sessions.</pre></div>
      <div id="permissions" class="panel"><h2>Permissions</h2><pre id="permissionsOut">Load account to view permissions.</pre></div>
      <div id="subscriptions" class="panel"><h2>Subscriptions</h2><pre id="subscriptionsOut">Load account to view subscriptions.</pre></div>
      <div id="apiKeys" class="panel"><h2>API Keys</h2><pre id="apiKeysOut">Load account to view API keys.</pre></div>
      <div id="organizations" class="panel"><h2>Organizations</h2><pre id="organizationsOut">Load account to view organizations.</pre></div>
      <div id="privacy" class="panel"><h2>Data & Privacy</h2><div class="row"><button onclick="exportData()">Export account data</button><button onclick="disableAiDataUse()">Disable AI data use</button><button class="danger" onclick="requestDeletion()">Request account deletion</button></div><pre id="privacyOut"></pre></div>
    </section>
  </main>
  <script nonce="${cspNonce}">
    const panels = ["profile","security","devices","sessions","permissions","subscriptions","apiKeys","organizations","privacy"];
    const state = { token: "" };
    function showPanel(id) { panels.forEach((panel) => document.getElementById(panel).classList.toggle("active", panel === id)); }
    function authHeaders() { state.token = document.getElementById("token").value || state.token; return { "content-type": "application/json", authorization: "Bearer " + state.token }; }
    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error?.message || "Request failed");
      return body.data;
    }
    function write(id, value) { document.getElementById(id).textContent = JSON.stringify(value, null, 2); }
    async function loadAccount() {
      const me = await api("/v1/auth/me");
      document.getElementById("displayName").value = me.user.displayName || "";
      document.getElementById("username").value = me.user.username || "";
      document.getElementById("firstName").value = me.user.profile?.firstName || "";
      document.getElementById("lastName").value = me.user.profile?.lastName || "";
      document.getElementById("country").value = me.user.profile?.country || "";
      document.getElementById("timezone").value = me.user.profile?.timezone || "";
      document.getElementById("language").value = me.user.profile?.language || "";
      document.getElementById("bio").value = me.user.profile?.bio || "";
      document.getElementById("emailStatus").textContent = me.user.emailVerified ? "Email verified" : "Email not verified";
      write("permissionsOut", me.permissions);
      write("devicesOut", await api("/v1/devices"));
      write("sessionsOut", await api("/v1/sessions"));
      write("subscriptionsOut", await api("/v1/subscriptions"));
      write("apiKeysOut", await api("/v1/api-keys"));
      write("organizationsOut", await api("/v1/organizations"));
    }
    async function saveProfile() {
      await api("/v1/auth/profile", { method: "PATCH", body: JSON.stringify({
        displayName: document.getElementById("displayName").value,
        username: document.getElementById("username").value,
        firstName: document.getElementById("firstName").value,
        lastName: document.getElementById("lastName").value,
        country: document.getElementById("country").value,
        timezone: document.getElementById("timezone").value,
        language: document.getElementById("language").value,
        bio: document.getElementById("bio").value
      })});
      await loadAccount();
    }
    async function changePassword() {
      await api("/v1/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: document.getElementById("currentPassword").value, newPassword: document.getElementById("newPassword").value }) });
      alert("Password changed. Existing sessions were revoked.");
    }
    async function revokeAllSessions() { await api("/v1/sessions", { method: "DELETE" }); await loadAccount(); }
    async function exportData() { write("privacyOut", await api("/v1/privacy/export")); }
    async function disableAiDataUse() { write("privacyOut", await api("/v1/privacy/disable-ai-data-use", { method: "POST" })); }
    async function requestDeletion() { write("privacyOut", await api("/v1/privacy/delete-account-request", { method: "POST" })); }
  </script>
</body>
</html>`);
});
