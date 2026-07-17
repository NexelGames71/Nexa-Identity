import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";
import { ensureDefaultProducts } from "../src/products/entitlement.service.js";

const app = createApp();
const ready = ensureDefaultProducts();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  return app(req, res);
}
