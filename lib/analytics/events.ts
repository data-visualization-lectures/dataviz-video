import { event } from "./gtag";

export type SignupMethod = "email" | "google" | "apple";

export const trackSignupStarted = () => event("signup_started");

export const trackSignupCompleted = (
  method: SignupMethod,
  isAcademia: boolean,
) => event("signup_completed", { method, is_academia: isAcademia });

export const trackLogin = (method: string) => event("login", { method });

export const trackCheckoutStarted = (
  plan: string,
  price: number,
  currency: string = "JPY",
) =>
  event("checkout_started", {
    plan,
    value: price,
    currency: currency.toUpperCase(),
  });

export const trackTrialStarted = (plan: string) =>
  event("trial_started", { plan });

export const trackPurchase = (
  plan: string,
  price: number,
  transactionId: string,
  currency: string = "JPY",
) =>
  event("purchase", {
    items: [{ item_id: plan }],
    value: price,
    currency: currency.toUpperCase(),
    transaction_id: transactionId,
  });

export const trackSubscriptionCanceled = (plan: string, reason?: string) =>
  event("subscription_canceled", { plan, reason });

export const trackToolOpened = (tool: string) =>
  event("tool_opened", { tool });

export const trackDataSampleLoaded = (tool: string, sample: string) =>
  event("data_sample_loaded", { tool, sample });

export const trackShareLinkCopied = (tool: string) =>
  event("share_link_copied", { tool });

export const trackVideoPlay = (videoId: string, title: string) =>
  event("video_play", { video_id: videoId, video_title: title });

export const trackVideoComplete = (videoId: string, title: string) =>
  event("video_complete", { video_id: videoId, video_title: title });
