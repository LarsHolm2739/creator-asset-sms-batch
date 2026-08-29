import { createServer } from "node:http";
import { ZodError } from "zod";
import { campaignRequestSchema, deliverAssetCampaign } from "./asset_campaign.js";
import { createInfraiSms, InfraiError } from "./infrai_sms.js";

const port = Number(process.env.PORT ?? 3000);

function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

function reply(response: import("node:http").ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/campaigns/deliver") {
    reply(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const input = campaignRequestSchema.parse(await readJson(request));
    const result = await deliverAssetCampaign(input, createInfraiSms());
    reply(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError) {
      reply(response, 400, { error: "invalid_request", issues: error.issues });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      reply(response, status, { error: error.code, message: error.message });
    } else {
      reply(response, 500, { error: "request_failed" });
    }
  }
}).listen(port, () => console.log(`campaign service listening on http://localhost:${port}`));
