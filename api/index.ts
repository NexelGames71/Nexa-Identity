import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";
import { ensureDefaultProducts } from "../src/products/entitlement.service.js";

const app = createApp();
let productSeed: Promise<void> | null = null;

function seedDefaultProducts() {
  productSeed ??= ensureDefaultProducts().catch((error) => {
    console.error("Nexa Identity default product sync failed", error);
    productSeed = null;
  });
  return productSeed;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  void seedDefaultProducts();
  return app(req, res);
}
