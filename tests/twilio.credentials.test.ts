import { describe, expect, it } from "vitest";
import "dotenv/config";

// NOTE: These tests require real Twilio credentials. Skip in CI/build environments.
describe.skip("Twilio credentials", () => {
  it("should have TWILIO_ACCOUNT_SID set", () => {
    expect(process.env.TWILIO_ACCOUNT_SID).toBeDefined();
    expect(process.env.TWILIO_ACCOUNT_SID!.length).toBeGreaterThan(0);
  });

  it("should have TWILIO_AUTH_TOKEN set", () => {
    expect(process.env.TWILIO_AUTH_TOKEN).toBeDefined();
    expect(process.env.TWILIO_AUTH_TOKEN!.length).toBeGreaterThan(0);
  });

  it("should have TWILIO_PHONE_NUMBER set", () => {
    expect(process.env.TWILIO_PHONE_NUMBER).toBeDefined();
    expect(process.env.TWILIO_PHONE_NUMBER!.length).toBeGreaterThan(0);
  });

  it("should have valid-format Account SID (starts with AC)", () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    expect(accountSid).toBeDefined();
    expect(accountSid!.startsWith("AC")).toBe(true);
    expect(accountSid!.length).toBe(34);
  });
});
