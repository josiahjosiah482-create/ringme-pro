import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER ?? "";

let _client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!accountSid || !authToken) {
    console.warn("[Twilio] Credentials not configured — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing");
    return null;
  }
  if (!_client) {
    _client = twilio(accountSid, authToken);
  }
  return _client;
}

/**
 * Send an SMS message via Twilio.
 * Returns the Twilio message SID on success, null if Twilio is not configured.
 */
export async function sendSMS(to: string, body: string): Promise<string | null> {
  const client = getTwilioClient();
  if (!client || !TWILIO_PHONE_NUMBER) {
    console.warn("[Twilio] Cannot send SMS — client or phone number not configured");
    return null;
  }
  try {
    const msg = await client.messages.create({
      from: TWILIO_PHONE_NUMBER,
      to,
      body,
    });
    return msg.sid;
  } catch (error) {
    console.error("[Twilio] Failed to send SMS:", error);
    throw error;
  }
}

/**
 * Generate TwiML for an outbound voice call.
 * Returns a TwiML string that Twilio will execute.
 */
export function generateOutboundCallTwiML(to: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: TWILIO_PHONE_NUMBER });
  dial.number({}, to);
  return twiml.toString();
}

/**
 * Generate TwiML for an inbound voice call — plays a greeting and records.
 */
export function generateInboundCallTwiML(callerName?: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  twiml.say(
    { voice: "Polly.Joanna" },
    `Hello${callerName ? `, ${callerName}` : ""}! You've reached RingMe. Please leave a message after the tone.`
  );
  twiml.record({
    maxLength: 120,
    transcribe: true,
    playBeep: true,
  });
  return twiml.toString();
}

/**
 * Generate TwiML for voicemail — plays a greeting and records.
 */
export function generateVoicemailTwiML(): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Joanna" }, "Please leave a message after the beep.");
  twiml.record({ maxLength: 120, transcribe: true, playBeep: true });
  return twiml.toString();
}

/**
 * Send an MMS message via Twilio (with media attachment).
 * Returns the Twilio message SID on success, null if Twilio is not configured.
 */
export async function sendMMS(
  to: string,
  body: string,
  mediaUrl: string,
  fromNumber?: string
): Promise<string | null> {
  const client = getTwilioClient();
  const from = fromNumber ?? TWILIO_PHONE_NUMBER;
  if (!client || !from) {
    console.warn("[Twilio] Cannot send MMS — client or phone number not configured");
    return null;
  }
  try {
    const msg = await client.messages.create({
      from,
      to,
      body,
      mediaUrl: [mediaUrl],
    });
    return msg.sid;
  } catch (error) {
    console.error("[Twilio] Failed to send MMS:", error);
    throw error;
  }
}

/**
 * Generate smart TwiML for inbound calls.
 * Handles spam warnings, custom greeting, and voicemail recording.
 */
export function generateSmartInboundTwiML(options: {
  spamScore: number;
  greetingUrl: string | null;
  recordingCallbackUrl: string;
}): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  if (options.spamScore >= 3) {
    twiml.say(
      { voice: "Polly.Joanna" },
      "Warning: this number has been reported as spam."
    );
  }

  if (options.greetingUrl) {
    twiml.play({}, options.greetingUrl);
  } else {
    twiml.say(
      { voice: "Polly.Joanna" },
      "You've reached RingMe. Please leave a message after the tone."
    );
  }

  twiml.record({
    maxLength: 120,
    transcribe: false,
    playBeep: true,
    recordingStatusCallback: options.recordingCallbackUrl,
    recordingStatusCallbackMethod: "POST",
  });

  return twiml.toString();
}

/**
 * Start recording an active call via Twilio API (Max plan feature).
 * Returns the recording SID on success.
 */
export async function startCallRecording(callSid: string): Promise<string | null> {
  const client = getTwilioClient();
  if (!client) {
    console.warn("[Twilio] Cannot start recording — client not configured");
    return null;
  }
  try {
    const recording = await client.calls(callSid).recordings.create();
    return recording.sid;
  } catch (error) {
    console.error("[Twilio] Failed to start call recording:", error);
    throw error;
  }
}

/**
 * Stop recording an active call via Twilio API.
 */
export async function stopCallRecording(
  callSid: string,
  recordingSid: string
): Promise<void> {
  const client = getTwilioClient();
  if (!client) return;
  try {
    await client.calls(callSid).recordings(recordingSid).update({ status: "stopped" });
  } catch (error) {
    console.error("[Twilio] Failed to stop call recording:", error);
    throw error;
  }
}

/**
 * Validate that a Twilio webhook request is authentic.
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}
