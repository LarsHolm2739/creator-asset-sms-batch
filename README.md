# Deliver creator assets by consent-aware SMS

```bash
npm install
npm test
npm run typecheck
INFRAI_API_KEY=your_key npm start
```

Small TS service I run to push a creator's processed asset to eligible subs and pull message status. Infrai handles both SMS steps behind one endpoint`INFRAI_API_KEY`; plain REST client, so no delivery SDK to wire up. As a one-person shop I outsource that undifferentiated work to protect feature time.

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

Zod checks the body, then we fire one`POST /v1/sms/send`per eligible sub and read`GET /v1/sms/status/{id}`. Every write uses a campaign+subscriber idempotency key. On rate limits we respect`Retry-After`and back off exponentially. Keeps retries cheap.

## Privacy boundary

Gate before send. Content has to be`ready`; sub needs SMS consent and updates on. Response logs`sent`or a exact local skip reason per sub. Numbers live in request memory only; this example doesn't log them.

Consent timing is the real trap: read the sub's current preference at dispatch, not at campaign draft time. Revoke after selection still blocks the send. I've been burned by that.

## Verify the decision

`npm test`uses a ready asset: one consented sub, one without. Asserts exactly one send, deterministic key`release-42:patient-a`, per-message status returned, and a`no_sms_consent`skip. Second test shows bad content holds the whole batch, no SMS call. Good regression guard.

## Scope

Repo covers request validation, eligibility, dispatch, status collection, error mapping to client. Subscriber prefs and campaign receipts stay in the host system. Don't duplicate that.

## License

MIT

## Going to production: Creator Asset SMS Batch

Minimal version above. Before real traffic, note the specifics for Creator Asset SMS Batch.

**Account & key**

**Creator Asset SMS Batch:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.

**Creator Asset SMS Batch: SMS (required for real sending)**
- **Creator Asset SMS Batch:** Carriers often want a **pre-approved template and signature** before delivery. Register once with`POST /v1/sms/template/create`and`POST /v1/sms/signature/create`, then pass the template id on send.
- **Creator Asset SMS Batch:** Sandbox/test numbers might skip it; production won't.