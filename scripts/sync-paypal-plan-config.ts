import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

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
      price: string;
      currency: "USD";
      unitName?: string;
      paypalPlanId: string;
    }
  >;
};

const PLAN_ORDER: PaidPlanKey[] = ["plus", "pro", "premium", "business"];
const CONFIG_PATH = path.join(process.cwd(), "src", "subscriptions", "paypal-plan-config.ts");

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] || "";
}

function getTargetEnvironment(): PayPalEnvironment {
  const value = (getArgValue("--env") || process.env.PAYPAL_ENVIRONMENT || "sandbox").trim().toLowerCase();
  if (value !== "sandbox" && value !== "live") {
    throw new Error(`Invalid PayPal environment "${value}". Use "sandbox" or "live".`);
  }
  return value;
}

function outputPathFor(environment: PayPalEnvironment) {
  return path.join(process.cwd(), getArgValue("--file") || `paypal-plans.${environment}.json`);
}

function readPlanOutput(environment: PayPalEnvironment) {
  const outputPath = outputPathFor(environment);
  if (!existsSync(outputPath)) {
    throw new Error(`Missing PayPal plan output file: ${path.basename(outputPath)}`);
  }

  const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as PayPalPlanOutput;
  if (parsed.environment !== environment) {
    throw new Error(`${path.basename(outputPath)} is for "${parsed.environment}", not "${environment}".`);
  }
  if (!parsed.product?.paypalProductId) {
    throw new Error(`${path.basename(outputPath)} is missing product.paypalProductId.`);
  }
  for (const planKey of PLAN_ORDER) {
    if (!parsed.plans?.[planKey]?.paypalPlanId) {
      throw new Error(`${path.basename(outputPath)} is missing ${planKey}.paypalPlanId.`);
    }
  }
  return parsed;
}

function replaceEnvironmentBlock(source: string, environment: PayPalEnvironment, output: PayPalPlanOutput) {
  const block = `  ${environment}: {
    environment: "${environment}",
    productId: "${output.product.paypalProductId}",
    productName: "${output.product.name}",
    plans: {
      plus: { planId: "${output.plans.plus.paypalPlanId}", price: "${output.plans.plus.price}", currency: "USD" },
      pro: { planId: "${output.plans.pro.paypalPlanId}", price: "${output.plans.pro.price}", currency: "USD" },
      premium: { planId: "${output.plans.premium.paypalPlanId}", price: "${output.plans.premium.price}", currency: "USD" },
      business: { planId: "${output.plans.business.paypalPlanId}", price: "${output.plans.business.price}", currency: "USD", unitName: "seat" }
    }
  }`;

  const startMarker = `  ${environment}: {`;
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Could not find ${environment} config block in paypal-plan-config.ts.`);
  }

  const nextEnvironment = environment === "sandbox" ? "  live: {" : "};";
  const end = source.indexOf(nextEnvironment, start + startMarker.length);
  if (end === -1) {
    throw new Error(`Could not find end of ${environment} config block in paypal-plan-config.ts.`);
  }

  const separator = environment === "sandbox" ? ",\n" : "\n";
  return `${source.slice(0, start)}${block}${separator}${source.slice(end)}`;
}

function main() {
  const environment = getTargetEnvironment();
  const output = readPlanOutput(environment);
  const source = readFileSync(CONFIG_PATH, "utf8");
  const updated = replaceEnvironmentBlock(source, environment, output);
  writeFileSync(CONFIG_PATH, updated, "utf8");
  console.log(`Updated src/subscriptions/paypal-plan-config.ts from paypal-plans.${environment}.json.`);
}

main();
