import { describe, it, expect } from "vitest";

describe("Twilio Credentials Validation", () => {
  it("TWILIO_ACCOUNT_SID is set and starts with AC", () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    expect(sid).toBeDefined();
    expect(sid).toBeTruthy();
    expect(sid!.startsWith("AC")).toBe(true);
  });

  it("TWILIO_AUTH_TOKEN is set and has valid length", () => {
    const token = process.env.TWILIO_AUTH_TOKEN;
    expect(token).toBeDefined();
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThanOrEqual(32);
  });

  it("TWILIO_PHONE_NUMBER is set and in E.164 format", () => {
    const phone = process.env.TWILIO_PHONE_NUMBER;
    expect(phone).toBeDefined();
    expect(phone).toBeTruthy();
    expect(phone!.startsWith("+")).toBe(true);
    expect(phone!.length).toBeGreaterThanOrEqual(10);
  });

  it("API_BASE_URL is set and is a valid URL", () => {
    const url = process.env.API_BASE_URL;
    expect(url).toBeDefined();
    expect(url).toBeTruthy();
    expect(url!.startsWith("https://")).toBe(true);
  });

  it("Twilio credentials can authenticate (API call)", async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      },
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sid).toBe(sid);
    expect(data.status).toBe("active");
  });
});
