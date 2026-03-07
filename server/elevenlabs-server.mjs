import { createServer } from "node:http";

const PORT = Number(process.env.ELEVENLABS_PROXY_PORT || 8787);
const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const extractText = (payload) => {
  if (typeof payload?.text === "string") return payload.text;
  if (typeof payload?.transcript === "string") return payload.transcript;
  if (Array.isArray(payload?.words)) {
    return payload.words
      .map((word) => (typeof word?.text === "string" ? word.text : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
};

const apiKey = process.env.ELEVENLABS_API_KEY;

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, hasApiKey: Boolean(apiKey) });
    return;
  }

  if (!apiKey) {
    sendJson(res, 500, { error: "ELEVENLABS_API_KEY is missing." });
    return;
  }

  if (req.method === "POST" && req.url === "/api/elevenlabs/tts") {
    try {
      const body = await readJsonBody(req);
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const voiceId = typeof body?.voiceId === "string" ? body.voiceId : DEFAULT_VOICE_ID;
      const modelId = typeof body?.modelId === "string" ? body.modelId : "eleven_flash_v2_5";
      if (!text) {
        sendJson(res, 400, { error: "text is required" });
        return;
      }

      const ttsResponse = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          output_format: "mp3_44100_128",
        }),
      });

      if (!ttsResponse.ok) {
        const err = await ttsResponse.text();
        sendJson(res, ttsResponse.status, { error: err || "TTS request failed" });
        return;
      }

      const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
      sendJson(res, 200, {
        audioBase64: audioBuffer.toString("base64"),
        mimeType: ttsResponse.headers.get("content-type") || "audio/mpeg",
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/elevenlabs/stt") {
    try {
      const body = await readJsonBody(req);
      const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64 : "";
      const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "audio/webm";
      const modelId = typeof body?.modelId === "string" ? body.modelId : "scribe_v1";
      if (!audioBase64) {
        sendJson(res, 400, { error: "audioBase64 is required" });
        return;
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "webm";
      const file = new File([audioBlob], `audio.${ext}`, { type: mimeType });
      const formData = new FormData();
      formData.append("model_id", modelId);
      formData.append("file", file);

      const sttResponse = await fetch(`${API_BASE}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: formData,
      });

      if (!sttResponse.ok) {
        const err = await sttResponse.text();
        sendJson(res, sttResponse.status, { error: err || "STT request failed" });
        return;
      }

      const payload = await sttResponse.json();
      sendJson(res, 200, { text: extractText(payload) });
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ElevenLabs proxy listening on http://localhost:${PORT}`);
});
