import { nanoid } from "nanoid";
import { env } from "../config/env.js";
import type { BillingCheckoutRequest, BillingCustomer, BillingProvider } from "./billing-provider.js";
import { BillingProviderUnavailableError } from "./billing-provider.js";

interface PayPalAccessTokenResponse {
  access_token: string;
}

interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

interface PayPalSubscriptionResponse {
  id: string;
  links?: PayPalLink[];
}

function paypalBaseUrl() {
  return env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function paypalPlanIds() {
  try {
    return JSON.parse(env.PAYPAL_PLAN_IDS) as Record<string, string | undefined>;
  } catch {
    throw new BillingProviderUnavailableError("PAYPAL_PLAN_IDS must be valid JSON.");
  }
}

export class PayPalBillingProvider implements BillingProvider {
  readonly name = "paypal";

  async createCustomer(input: { userId: string; email: string }): Promise<BillingCustomer> {
    return { id: input.userId, email: input.email };
  }

  async createCheckoutSession(input: BillingCheckoutRequest): Promise<{ url: string; externalId?: string }> {
    const planId = paypalPlanIds()[input.planId];
    if (!planId) {
      throw new BillingProviderUnavailableError(`No PayPal plan id configured for plan "${input.planId}".`);
    }

    const accessToken = await this.getAccessToken();
    const response = await this.paypalRequest<PayPalSubscriptionResponse>(
      "/v1/billing/subscriptions",
      {
        method: "POST",
        accessToken,
        body: {
          plan_id: planId,
          custom_id: input.userId,
          subscriber: {
            email_address: input.billingCustomerEmail ?? undefined
          },
          application_context: {
            brand_name: "Nexa",
            locale: "en-US",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            return_url: input.successUrl,
            cancel_url: input.cancelUrl
          }
        }
      }
    );

    const approvalUrl = response.links?.find((link) => link.rel === "approve")?.href;
    if (!approvalUrl) {
      throw new BillingProviderUnavailableError("PayPal did not return an approval URL.");
    }

    return { url: approvalUrl, externalId: response.id };
  }

  async cancelSubscription(input: { billingSubscriptionId: string }): Promise<void> {
    const accessToken = await this.getAccessToken();
    await this.paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(input.billingSubscriptionId)}/cancel`, {
      method: "POST",
      accessToken,
      body: { reason: "User requested cancellation through Nexa Identity." }
    });
  }

  private async getAccessToken() {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      throw new BillingProviderUnavailableError("PayPal credentials are not configured.");
    }

    const credentials = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
    const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ grant_type: "client_credentials" })
    });

    if (!response.ok) {
      throw new BillingProviderUnavailableError("PayPal authentication failed.");
    }

    const body = (await response.json()) as PayPalAccessTokenResponse;
    if (!body.access_token) {
      throw new BillingProviderUnavailableError("PayPal authentication did not return an access token.");
    }

    return body.access_token;
  }

  private async paypalRequest<T = unknown>(
    path: string,
    input: { method: "POST" | "GET"; accessToken: string; body?: unknown }
  ): Promise<T> {
    const response = await fetch(`${paypalBaseUrl()}${path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": nanoid()
      },
      body: input.body ? JSON.stringify(input.body) : undefined
    });

    if (!response.ok) {
      throw new BillingProviderUnavailableError(`PayPal request failed with status ${response.status}.`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
