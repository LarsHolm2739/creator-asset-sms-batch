import assert from "node:assert/strict";
import test from "node:test";
import { deliverAssetCampaign } from "../src/asset_campaign.js";
import type { SmsTransport } from "../src/infrai_sms.js";

test("sends only to consented subscribers when the asset is ready", async () => {
  const sends: Array<{ to: string; key: string }> = [];
  const sms: SmsTransport = {
    async send(to, _body, key) {
      sends.push({ to, key });
      return { message_id: "msg_101" };
    },
    async status(id) {
      return { message_id: id, status: "queued" };
    },
  };

  const result = await deliverAssetCampaign({
    campaignId: "release-42",
    asset: {
      title: "Mobility guide",
      deliveryUrl: "https://creator.example/download/asset-42",
      processingState: "ready",
    },
    subscribers: [
      { subscriberId: "patient-a", phone: "+15550000001", smsConsent: true, updatesEnabled: true },
      { subscriberId: "patient-b", phone: "+15550000002", smsConsent: false, updatesEnabled: true },
    ],
  }, sms);

  assert.deepEqual(sends, [{ to: "+15550000001", key: "release-42:patient-a" }]);
  assert.deepEqual(result.messages, [
    { subscriberId: "patient-a", outcome: "sent", messageId: "msg_101", status: { message_id: "msg_101", status: "queued" } },
    { subscriberId: "patient-b", outcome: "skipped", reason: "no_sms_consent" },
  ]);
});

test("holds every message while content processing is incomplete", async () => {
  const sms: SmsTransport = {
    async send() { throw new Error("send should not run"); },
    async status() { throw new Error("status should not run"); },
  };
  const result = await deliverAssetCampaign({
    campaignId: "release-43",
    asset: { title: "Nutrition guide", deliveryUrl: "https://creator.example/download/asset-43", processingState: "processing" },
    subscribers: [{ subscriberId: "member-a", phone: "+15550000003", smsConsent: true, updatesEnabled: true }],
  }, sms);

  assert.equal(result.messages[0]?.outcome, "skipped");
  assert.deepEqual(result.messages[0], { subscriberId: "member-a", outcome: "skipped", reason: "asset_not_ready" });
});
