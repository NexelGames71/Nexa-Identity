import { Router } from "express";
import { defaultRedirectUri, validateClientUrl } from "../auth/auth-code.service.js";
import { identityBaseUrl } from "../config/env.js";

export const identityUiRouter = Router();

type PageMode = "login" | "signup" | "forgot-password";

function safeUrl(value: unknown, fallback: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  try {
    return validateClientUrl(value);
  } catch {
    return fallback;
  }
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function authPage(params: {
  mode: PageMode;
  title: string;
  subtitle: string;
  nonce: string;
  clientId: string;
  returnTo: string;
  redirectUri: string;
  state: string;
}) {
  const boot = JSON.stringify({
    mode: params.mode,
    identityBaseUrl,
    clientId: params.clientId,
    returnTo: params.returnTo,
    redirectUri: params.redirectUri,
    state: params.state
  }).replace(/</g, "\\u003c");

  const isSignup = params.mode === "signup";
  const isForgot = params.mode === "forgot-password";
  const authQuery = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    return_to: params.returnTo
  });
  if (params.state) {
    authQuery.set("state", params.state);
  }
  const authQueryString = authQuery.toString();
  const loginHref = `/login?${authQueryString}`;
  const signupHref = `/signup?${authQueryString}`;
  const forgotHref = `/forgot-password?${authQueryString}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.title} | Nexa Identity</title>
  <style>
    :root { color-scheme: light; --ink:#101010; --muted:#6b7280; --line:#e5e7eb; --panel:#fff; --bg:#f6f6f4; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--ink); }
    header { height:72px; display:flex; align-items:center; justify-content:space-between; padding:0 32px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.76); backdrop-filter:blur(16px); }
    .brand { display:flex; align-items:center; gap:12px; font-weight:700; }
    .mark { width:34px; height:34px; border-radius:999px; background:#111; color:white; display:grid; place-items:center; font-weight:800; }
    main { min-height:calc(100vh - 72px); display:grid; place-items:center; padding:32px 18px; }
    .card { width:min(100%, 448px); background:var(--panel); border:1px solid var(--line); border-radius:30px; padding:32px; box-shadow:0 28px 80px rgba(16,16,16,.08); }
    .eyebrow { letter-spacing:.28em; text-transform:uppercase; color:var(--muted); font-size:12px; font-weight:700; margin-bottom:18px; }
    h1 { margin:0; font-size:30px; letter-spacing:0; line-height:1.1; }
    p { color:var(--muted); line-height:1.55; }
    form { display:grid; gap:14px; margin-top:26px; }
    input { width:100%; border:1px solid var(--line); border-radius:18px; padding:15px 16px; font:inherit; outline:none; background:#fff; }
    input:focus { border-color:#111; box-shadow:0 0 0 4px rgba(17,17,17,.08); }
    button { border:0; border-radius:18px; padding:15px 18px; font:inherit; font-weight:700; background:#111; color:#fff; cursor:pointer; }
    button:disabled { opacity:.58; cursor:not-allowed; }
    .row { display:flex; justify-content:space-between; gap:16px; align-items:center; margin-top:18px; color:var(--muted); font-size:14px; }
    a { color:#111; text-underline-offset:4px; }
    .error { display:none; margin-top:16px; border:1px solid #fecaca; background:#fff1f2; color:#b91c1c; border-radius:16px; padding:12px 14px; font-size:14px; }
    .success { display:none; margin-top:16px; border:1px solid #bbf7d0; background:#f0fdf4; color:#166534; border-radius:16px; padding:12px 14px; font-size:14px; }
  </style>
</head>
<body>
  <header>
    <div class="brand"><span class="mark">N</span><span>Nexa Identity</span></div>
    <a href="${escapeAttr(params.returnTo)}">Back to Nexa</a>
  </header>
  <main>
    <section class="card">
      <div class="eyebrow">Nexa</div>
      <h1>${params.title}</h1>
      <p>${params.subtitle}</p>
      <form id="auth-form">
        ${isSignup ? '<input id="name" name="name" autocomplete="name" placeholder="Full name" required />' : ""}
        ${!isForgot ? '<input id="email" name="email" autocomplete="email" type="email" placeholder="Email" required />' : '<input id="email" name="email" autocomplete="email" type="email" placeholder="Email" required />'}
        ${!isForgot ? '<input id="password" name="password" autocomplete="' + (isSignup ? "new-password" : "current-password") + '" type="password" placeholder="Password" required />' : ""}
        <button id="submit" type="submit">${isForgot ? "Send reset link" : isSignup ? "Create account" : "Sign in"}</button>
      </form>
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
      <div class="row">
        ${
          isSignup
            ? `<a href="${escapeAttr(loginHref)}">Already have an account?</a>`
            : `<a href="${escapeAttr(signupHref)}">Create account</a>`
        }
        ${!isForgot ? `<a href="${escapeAttr(forgotHref)}">Forgot password?</a>` : `<a href="${escapeAttr(loginHref)}">Back to sign in</a>`}
      </div>
    </section>
  </main>
  <script nonce="${params.nonce}">
    window.__NEXA_AUTH_BOOT__ = ${boot};
  </script>
  <script nonce="${params.nonce}">
    const boot = window.__NEXA_AUTH_BOOT__;
    const form = document.getElementById("auth-form");
    const button = document.getElementById("submit");
    const errorBox = document.getElementById("error");
    const successBox = document.getElementById("success");
    function showError(message) {
      errorBox.textContent = message || "The request failed.";
      errorBox.style.display = "block";
      successBox.style.display = "none";
    }
    function showSuccess(message) {
      successBox.textContent = message;
      successBox.style.display = "block";
      errorBox.style.display = "none";
    }
    function compactText(value, max, fallback) {
      const text = typeof value === "string" && value.trim().length ? value.trim() : fallback;
      return text.slice(0, max);
    }
    async function postJson(path, body, token) {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        const requestError = new Error(payload?.error?.message || payload?.message || "Nexa Identity request failed.");
        requestError.status = response.status;
        requestError.code = payload?.error?.code || payload?.code;
        throw requestError;
      }
      return payload.data || payload;
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      errorBox.style.display = "none";
      try {
        const email = document.getElementById("email")?.value?.trim();
        const password = document.getElementById("password")?.value;
        if (boot.mode === "forgot-password") {
          await postJson("/v1/auth/password-reset/request", { email });
          showSuccess("If that account exists, Nexa sent password reset instructions.");
          return;
        }
        if (boot.mode === "signup") {
          const displayName = document.getElementById("name")?.value?.trim() || email;
          const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 24);
          try {
            await postJson("/v1/auth/register", {
              email,
              password,
              displayName,
              username: baseUsername.length >= 3 ? baseUsername : "user" + Date.now()
            });
          } catch (error) {
            if (error?.status !== 409) {
              throw error;
            }
          }
        }
        const session = await postJson("/v1/auth/login", {
          identifier: email,
          password,
          deviceName: "Nexa Web",
          deviceType: "browser",
          platform: compactText(navigator.platform, 80, "web"),
          browser: compactText(navigator.userAgent, 80, "web")
        });
        const code = await postJson("/v1/auth/authorize-code", {
          clientId: boot.clientId,
          redirectUri: boot.redirectUri,
          returnTo: boot.returnTo
        }, session.tokens.accessToken);
        const target = new URL(code.redirectUri);
        target.searchParams.set("code", code.code);
        target.searchParams.set("state", boot.state || "");
        window.location.assign(target.toString());
      } catch (error) {
        showError(error?.message);
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function render(req: any, res: any, mode: PageMode) {
  const clientId = typeof req.query.client_id === "string" ? req.query.client_id : "nexa-web";
  const redirectUri = safeUrl(req.query.redirect_uri, defaultRedirectUri(clientId));
  const returnTo = safeUrl(req.query.return_to, redirectUri.replace(/\/auth\/callback$/, "/chat"));
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const title =
    mode === "signup" ? "Create your account" : mode === "forgot-password" ? "Reset your password" : "Welcome back";
  const subtitle =
    mode === "signup"
      ? "Start using Nexa across chat, browser assistance, memory, and creative tools."
      : mode === "forgot-password"
        ? "Enter your Nexa account email and we will send reset instructions."
        : "Sign in with Nexa Identity to continue to your workspace.";

  res.type("html").send(
    authPage({
      mode,
      title,
      subtitle,
      nonce: res.locals.cspNonce,
      clientId,
      redirectUri,
      returnTo,
      state
    })
  );
}

identityUiRouter.get("/login", (req, res) => render(req, res, "login"));
identityUiRouter.get("/signup", (req, res) => render(req, res, "signup"));
identityUiRouter.get("/forgot-password", (req, res) => render(req, res, "forgot-password"));
