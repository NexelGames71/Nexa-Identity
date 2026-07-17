import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { ensureDefaultProducts } from "./products/entitlement.service.js";

await ensureDefaultProducts();

const app = createApp();

app.listen(env.APP_PORT, () => {
  console.log(`Nexa Identity listening on port ${env.APP_PORT}`);
});
