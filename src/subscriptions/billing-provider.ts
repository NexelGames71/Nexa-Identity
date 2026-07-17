export interface BillingCheckoutRequest {
  userId: string;
  planId: string;
  billingCustomerId?: string;
  billingCustomerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingCustomer {
  id: string;
  email: string;
}

export interface BillingProvider {
  readonly name: string;
  createCustomer(input: { userId: string; email: string; displayName?: string }): Promise<BillingCustomer>;
  createCheckoutSession(input: BillingCheckoutRequest): Promise<{ url: string; externalId?: string }>;
  cancelSubscription(input: { billingSubscriptionId: string }): Promise<void>;
}

export class ManualBillingProvider implements BillingProvider {
  readonly name = "manual";

  async createCustomer(input: { userId: string; email: string }): Promise<BillingCustomer> {
    return { id: `manual_${input.userId}`, email: input.email };
  }

  async createCheckoutSession(): Promise<{ url: string }> {
    throw new BillingProviderUnavailableError("Manual billing provider does not support checkout sessions.");
  }

  async cancelSubscription(): Promise<void> {
    return;
  }
}

export class BillingProviderUnavailableError extends Error {
  constructor(message = "Billing provider is not configured.") {
    super(message);
    this.name = "BillingProviderUnavailableError";
  }
}
