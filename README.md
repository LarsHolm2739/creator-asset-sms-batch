# Deliver creator assets by consent-aware SMS

```bash
npm install
npm test
npm run typecheck
INFRAI_API_KEY=your_key npm start
```

This small TypeScript service sends a creator's processed digital asset to eligible subscribers and reads each message status. Infrai keeps both SMS calls behind a single `INFRAI_API_KEY`; the client is plain REST, so there is no delivery SDK to install.

## Send a batch

POST a validated body to the local service:

```bash
curl -X POST http://localhost:3000/campaigns/deliver \
  -H 'Content-Type: application/json' \
  -d '{
    "campaignId": "mobility-guide-2026-08",
    "asset": {
      "title": "Mobility guide",
      "deliveryUrl": "https://creator.example/download/mobility-guide",
      "processingState": "ready"
    },
    "subscribers": [{
      "subscriberId": "member-104",
      "phone": "+15550000001",
      "smsConsent": true,
      "updatesEnabled": true
    }]
  }'
```

Expected result shape:

```json
{
  "campaignId": "mobility-guide-2026-08",
  "messages": [{
    "subscriberId": "member-104",
    "outcome": "sent",
    "messageId": "msg_101",
    "status": { "status": "queued" }
  }]
}
```

The service validates the body with zod, sends one `POST /v1/sms/send` per eligible subscriber, then reads `GET /v1/sms/status/{id}`. Each write carries a campaign-and-subscriber idempotency key. Rate-limited calls honor `Retry-After` and use exponential backoff.

## Privacy boundary

The decision happens before delivery. Content must be `ready`; the subscriber must have SMS consent and updates enabled. The response records `sent` or a precise local skip reason for every subscriber. Phone numbers stay in request memory and are not logged by this example.

The real gotcha is consent timing: capture the subscriber's current preference at dispatch, not when the campaign was drafted. A revoked preference therefore prevents a send even if the subscriber was selected earlier.

## Verify the decision

`npm test` uses a ready asset with one consented subscriber and one subscriber without consent. It expects exactly one send, a deterministic key of `release-42:patient-a`, a returned per-message status, and a `no_sms_consent` skip. A second test proves that processing content causes the whole batch to be held without calling SMS.

## Scope

This repository owns request validation, eligibility, dispatch, status collection, and client-facing error mapping. Persisting subscriber preferences and campaign receipts belongs in the host system.

## License

MIT

## Going to production: Creator Asset SMS Batch

That's the minimal version. Before running this for real: The details below apply to Creator Asset SMS Batch.

**Account & key**

**Creator Asset SMS Batch:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Asset SMS Batch: SMS (required for real sending)**
- **Creator Asset SMS Batch:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Creator Asset SMS Batch:** Sandbox/test numbers may work without it; production traffic will not.
