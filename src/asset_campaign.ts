import { z } from "zod";
import type { SmsTransport } from "./infrai_sms.js";

export const campaignRequestSchema = z.object({
  campaignId: z.string().min(1).max(80),
  asset: z.object({
    title: z.string().min(1).max(120),
    deliveryUrl: z.string().url(),
    processingState: z.enum(["ready", "processing", "rejected"]),
  }),
  subscribers: z.array(z.object({
    subscriberId: z.string().min(1).max(80),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    smsConsent: z.boolean(),
    updatesEnabled: z.boolean(),
  })).min(1).max(100),
});

export type CampaignRequest = z.infer<typeof campaignRequestSchema>;
export type CampaignResult = {
  campaignId: string;
  messages: Array<
    | { subscriberId: string; outcome: "sent"; messageId: string; status: Record<string, unknown> }
    | { subscriberId: string; outcome: "skipped"; reason: "asset_not_ready" | "no_sms_consent" | "updates_disabled" }
  >;
};

export async function deliverAssetCampaign(
  request: CampaignRequest,
  sms: SmsTransport,
): Promise<CampaignResult> {
  const messages: CampaignResult["messages"] = [];

  for (const subscriber of request.subscribers) {
    if (request.asset.processingState !== "ready") {
      messages.push({ subscriberId: subscriber.subscriberId, outcome: "skipped", reason: "asset_not_ready" });
      continue;
    }
    if (!subscriber.smsConsent) {
      messages.push({ subscriberId: subscriber.subscriberId, outcome: "skipped", reason: "no_sms_consent" });
      continue;
    }
    if (!subscriber.updatesEnabled) {
      messages.push({ subscriberId: subscriber.subscriberId, outcome: "skipped", reason: "updates_disabled" });
      continue;
    }

    const body = `${request.asset.title} is ready: ${request.asset.deliveryUrl}`;
    const idempotencyKey = `${request.campaignId}:${subscriber.subscriberId}`;
    const sent = await sms.send(subscriber.phone, body, idempotencyKey);
    const status = await sms.status(sent.message_id);
    messages.push({ subscriberId: subscriber.subscriberId, outcome: "sent", messageId: sent.message_id, status });
  }

  return { campaignId: request.campaignId, messages };
}
