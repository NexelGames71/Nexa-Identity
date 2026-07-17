import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getPayPalEnvironmentConfig } from "../src/subscriptions/paypal-plan-config.js";

type PayPalEnvironment = "sandbox" | "live";
type PaidPlanKey = "plus" | "pro" | "premium" | "business";

type PayPalPlanOutput = {
  environment: PayPalEnvironment;
  product: {
    name: string;
    paypalProductId: string;
  };
  plans: Record<
    PaidPlanKey,
    {
      name: string;
      price: string;
      currency: string;
      billingType: "fixed" | "per_seat";
      unitName?: string;
      paypalPlanId: string;
    }
  >;
  createdAt: string;
};

const PRODUCT_DESCRIPTION = "Recurring subscription plans for Nexa AI.";
const PLAN_ORDER: PaidPlanKey[] = ["plus", "pro", "premium", "business"];

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnvironmentVariables() {
  for (const filename of [".env.local", ".env"]) {
    loadEnvFile(path.join(process.cwd(), filename));
  }
}

function getArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    force: args.has("--force"),
    confirmLive: args.has("--confirm-live"),
  };
}

function getTargetEnvironment(): PayPalEnvironment {
  const value = (process.env.PAYPAL_ENVIRONMENT || process.env.PAYPAL_ENV || "sandbox").trim().toLowerCase();
  if (value !== "sandbox" && value !== "live") {
    throw new Error(`Invalid PayPal environment "${value}". Use "sandbox" or "live".`);
  }
  return value;
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  throw new Error(`Missing required environment variable. Tried: ${names.join(", ")}`);
}

function optionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function getCredentials(environment: PayPalEnvironment) {
  if (environment === "live") {
    return {
      clientId: requiredEnv("PAYPAL_CLIENT_ID", "PAYPAL_LIVE_CLIENT_ID"),
      clientSecret: requiredEnv("PAYPAL_CLIENT_SECRET", "PAYPAL_LIVE_CLIENT_SECRET"),
      existingProductId: optionalEnv("PAYPAL_PRODUCT_ID", "PAYPAL_LIVE_PRODUCT_ID"),
    };
  }

  return {
    clientId: requiredEnv("PAYPAL_CLIENT_ID", "PAYPAL_SANDBOX_CLIENT_ID"),
    clientSecret: requiredEnv("PAYPAL_CLIENT_SECRET", "PAYPAL_SANDBOX_CLIENT_SECRET"),
    existingProductId: optionalEnv("PAYPAL_PRODUCT_ID", "PAYPAL_SANDBOX_PRODUCT_ID"),
  };
}

function paypalBaseUrl(environment: PayPalEnvironment) {
  return environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function outputPathFor(environment: PayPalEnvironment) {
  return path.join(process.cwd(), `paypal-plans.${environment}.json`);
}

function readExistingOutput(environment: PayPalEnvironment): PayPalPlanOutput | null {
  const outputPath = outputPathFor(environment);
  if (!existsSync(outputPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as PayPalPlanOutput;
  if (parsed.environment !== environment) {
    throw new Error(`Existing ${path.basename(outputPath)} is for "${parsed.environment}", not "${environment}".`);
  }
  return parsed;
}

function outputHasAllRequiredIds(output: PayPalPlanOutput | null) {
  if (!output?.product?.paypalProductId) {
    return false;
  }
  return PLAN_ORDER.every((planKey) => Boolean(output.plans?.[planKey]?.paypalPlanId));
}

async function parsePayPalResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function paypalRequest(
  environment: PayPalEnvironment,
  pathname: string,
  accessToken: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${paypalBaseUrl(environment)}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const data = await parsePayPalResponse(response);

  if (!response.ok) {
    const detail =
      typeof data === "object" && data
        ? (data as any).message || (data as any).name || JSON.stringify(data)
        : String(data || "");
    throw new Error(`PayPal request failed (${response.status}) ${pathname}: ${detail}`);
  }

  return data;
}

async function getAccessToken(environment: PayPalEnvironment, clientId: string, clientSecret: string) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl(environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await parsePayPalResponse(response);
  if (!response.ok || !data?.access_token) {
    const detail =
      typeof data === "object" && data
        ? (data as any).error_description || (data as any).error || JSON.stringify(data)
        : String(data || "");
    throw new Error(`PayPal authentication failed: ${detail || response.status}`);
  }
  return String(data.access_token);
}

async function findProductByName(environment: PayPalEnvironment, accessToken: string, productName: string) {
  const data = await paypalRequest(
    environment,
    "/v1/catalogs/products?page_size=20&page=1&total_required=true",
    accessToken,
  );
  const products = Array.isArray(data?.products) ? data.products : [];
  return products.find((product: any) => product?.name === productName) || null;
}

async function createProduct(environment: PayPalEnvironment, accessToken: string, productName: string) {
  return paypalRequest(environment, "/v1/catalogs/products", accessToken, {
    method: "POST",
    headers: {
      "PayPal-Request-Id": `nexa-${environment}-subscription-product`,
    },
    body: JSON.stringify({
      name: productName,
      description: PRODUCT_DESCRIPTION,
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
}

async function getOrCreateProduct(
  environment: PayPalEnvironment,
  accessToken: string,
  productName: string,
  existingProductId: string,
  outputProductId = "",
) {
  if (existingProductId) {
    return { id: existingProductId, name: productName };
  }

  if (outputProductId) {
    return { id: outputProductId, name: productName };
  }

  try {
    const existingProduct = await findProductByName(environment, accessToken, productName);
    if (existingProduct?.id) {
      return existingProduct;
    }
  } catch (error) {
    console.warn(
      `Could not list PayPal products, creating a new product instead: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const product = await createProduct(environment, accessToken, productName);
  if (!product?.id) {
    throw new Error("PayPal product creation succeeded but did not return an id.");
  }
  return product;
}

function planRequestId(environment: PayPalEnvironment, planKey: PaidPlanKey, price: string) {
  return `nexa-${environment}-${planKey}-${price}-monthly`;
}

async function createPlan(
  environment: PayPalEnvironment,
  accessToken: string,
  productId: string,
  planKey: PaidPlanKey,
) {
  const config = getPayPalEnvironmentConfig(environment);
  const plan = config.plans[planKey];
  const displayName = `Nexa ${planKey[0].toUpperCase()}${planKey.slice(1)}`;
  const description =
    plan.unitName === "seat" ? `${displayName} monthly subscription billed per seat` : `${displayName} monthly subscription`;

  return paypalRequest(environment, "/v1/billing/plans", accessToken, {
    method: "POST",
    headers: {
      "PayPal-Request-Id": planRequestId(environment, planKey, plan.price),
    },
    body: JSON.stringify({
      product_id: productId,
      name: displayName,
      description,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: plan.price,
              currency_code: plan.currency,
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });
}

function outputPlanEntry(environment: PayPalEnvironment, planKey: PaidPlanKey, paypalPlanId: string) {
  const plan = getPayPalEnvironmentConfig(environment).plans[planKey];
  const displayName = `Nexa ${planKey[0].toUpperCase()}${planKey.slice(1)}`;
  return {
    name: displayName,
    price: plan.price,
    currency: plan.currency,
    billingType: plan.unitName === "seat" ? ("per_seat" as const) : ("fixed" as const),
    ...(plan.unitName ? { unitName: plan.unitName } : {}),
    paypalPlanId,
  };
}

async function main() {
  loadEnvironmentVariables();

  const { force, confirmLive } = getArgs();
  const environment = getTargetEnvironment();
  if (environment === "live" && !confirmLive) {
    throw new Error("Live PayPal plan creation requires --confirm-live.");
  }

  const config = getPayPalEnvironmentConfig(environment);
  const outputPath = outputPathFor(environment);
  const existingOutput = readExistingOutput(environment);

  if (existingOutput && !force && outputHasAllRequiredIds(existingOutput)) {
    console.log(`Existing ${path.basename(outputPath)} already has product and plan IDs.`);
    console.log("Pass --force to create new PayPal plans.");
    return;
  }

  console.log(`Creating Nexa PayPal plans for ${environment}.`);
  const credentials = getCredentials(environment);
  const accessToken = await getAccessToken(environment, credentials.clientId, credentials.clientSecret);
  const product = await getOrCreateProduct(
    environment,
    accessToken,
    config.productName,
    credentials.existingProductId,
    !force ? existingOutput?.product?.paypalProductId : "",
  );

  const output: PayPalPlanOutput = {
    environment,
    product: {
      name: config.productName,
      paypalProductId: product.id,
    },
    plans: {} as PayPalPlanOutput["plans"],
    createdAt: new Date().toISOString(),
  };

  for (const planKey of PLAN_ORDER) {
    const existingPlanId = !force ? existingOutput?.plans?.[planKey]?.paypalPlanId : "";
    if (existingPlanId) {
      console.log(`Reusing ${planKey}: ${existingPlanId}`);
      output.plans[planKey] = outputPlanEntry(environment, planKey, existingPlanId);
      continue;
    }

    const paypalPlan = await createPlan(environment, accessToken, product.id, planKey);
    if (!paypalPlan?.id) {
      throw new Error(`PayPal plan creation for ${planKey} did not return an id.`);
    }

    console.log(`Created ${planKey}: ${paypalPlan.id}`);
    output.plans[planKey] = outputPlanEntry(environment, planKey, paypalPlan.id);
  }

  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Saved ${path.basename(outputPath)}.`);
  console.log(`Run: npm.cmd run paypal:sync-plan-config -- --env ${environment}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
