let app = null;
let productSeed = null;

async function getApp() {
  if (!app) {
    const appModule = await import("../dist/src/app.js");
    app = appModule.createApp();
  }
  return app;
}

async function seedDefaultProducts() {
  const productsModule = await import("../dist/src/products/entitlement.service.js");
  productSeed ??= productsModule.ensureDefaultProducts().catch((error) => {
    console.error("Nexa Identity default product sync failed", error);
    productSeed = null;
  });
  return productSeed;
}

function escapeHtml(value) {
  return String(value).replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] ?? char);
}

function writeStartupError(req, res, error) {
  const message = error instanceof Error ? error.message : "Nexa Identity startup failed.";
  console.error("Nexa Identity startup failed", error);

  if (req.url?.startsWith("/health")) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, service: "nexa-identity", error: "startup_failed", message }));
    return;
  }

  res.statusCode = 500;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nexa Identity startup failed</title>
    <style>
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f7f7f8; color: #111; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 680px; border: 1px solid #ffd0d0; background: #fff3f3; border-radius: 24px; padding: 28px; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { line-height: 1.6; }
      code { background: #fff; border: 1px solid #ffd0d0; border-radius: 10px; display: block; padding: 12px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Nexa Identity could not start</h1>
        <p>The authentication pages are installed, but the server failed during startup before routing could run.</p>
        <code>${escapeHtml(message)}</code>
      </section>
    </main>
  </body>
</html>`);
}

export default async function handler(req, res) {
  try {
    const expressApp = await getApp();
    void seedDefaultProducts();
    return expressApp(req, res);
  } catch (error) {
    return writeStartupError(req, res, error);
  }
}
