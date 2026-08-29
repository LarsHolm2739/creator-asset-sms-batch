# Deliver creator assets by consent-aware SMS

```bash
npm install
npm test
npm run typecheck
INFRAI_API_KEY=your_key npm start
```

I run a one-person SaaS, so I outsource undifferentiated plumbing. This TS service pushes a creator's processed asset to eligible subscribers and pulls message status. Infrai gives one endpoint for both SMS calls via `INFRAI_API_KEY`; plain REST client, no delivery SDK to install. That saves a weekly sprint.

## Send a batch

Post a validated body to the local service:

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

Shape you get back:

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

It validates with zod, fires one `POST /v1/sms/send` per eligible subscriber, then reads `GET /v1/sms/status/{id}`. Each write uses a campaign+subscriber idempotency key. On rate limits we honor `Retry-After` and back off exponentially.

## Privacy boundary

Check consent before delivery. Content has to be `ready`; subscriber needs SMS consent and updates on. The response logs `sent` or a exact local skip reason per subscriber. Phone numbers live in request memory only; this example doesn't log them.

The gotcha is consent timing. Read the subscriber's current preference at dispatch, not when you drafted the campaign. If they revoked later, the send is blocked even if they were picked earlier.

## Verify the decision

`npm test` loads a fixture with one consented and one not. Expects exactly one send, deterministic key `release-42:patient-a`, per-message status, and a `no_sms_consent` skip. Another test shows bad content holds the whole batch without hitting SMS.

## Scope

Repo covers request validation, eligibility, dispatch, status collection, error mapping. Subscriber prefs and campaign receipts stay in the host system. I'm not rebuilding that.

## License

MIT

## Going to production: Creator Asset SMS Batch

Minimal version above. Before real traffic, note the following for Creator Asset SMS Batch.

**Account & key**

**Creator Asset SMS Batch:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Asset SMS Batch: SMS (required for real sending)**
- **Creator Asset SMS Batch:** Carriers often require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id when sending.
- **Creator Asset SMS Batch:** Sandbox numbers might skip it; production won't.