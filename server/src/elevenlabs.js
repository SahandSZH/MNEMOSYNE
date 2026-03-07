const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";

function extractText(payload) {
  if (typeof payload?.text === "string") return payload.text;
  if (typeof payload?.transcript === "string") return payload.transcript;
  if (Array.isArray(payload?.words)) {
    return payload.words
      .map((word) => (typeof word?.text === "string" ? word.text : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function getAudioExtension(mimeType) {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp3")) return "mp3";
  return "webm";
}

export function registerElevenLabsRoutes(app) {
  app.post("/api/elevenlabs/tts", async (req, res) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY is missing." });
    }

    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const voiceId =
        typeof req.body?.voiceId === "string" ? req.body.voiceId : DEFAULT_VOICE_ID;
      const modelId =
        typeof req.body?.modelId === "string" ? req.body.modelId : "eleven_flash_v2_5";

      if (!text) {
        return res.status(400).json({ error: "text is required" });
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
        return res.status(ttsResponse.status).json({ error: err || "TTS request failed" });
      }

      const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
      return res.status(200).json({
        audioBase64: audioBuffer.toString("base64"),
        mimeType: ttsResponse.headers.get("content-type") || "audio/mpeg",
      });
    } catch (error) {
      return res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/elevenlabs/stt", async (req, res) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY is missing." });
    }

    try {
      const audioBase64 =
        typeof req.body?.audioBase64 === "string" ? req.body.audioBase64 : "";
      const mimeType =
        typeof req.body?.mimeType === "string" ? req.body.mimeType : "audio/webm";
      const modelId =
        typeof req.body?.modelId === "string" ? req.body.modelId : "scribe_v1";

      if (!audioBase64) {
        return res.status(400).json({ error: "audioBase64 is required" });
      }

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      const formData = new FormData();
      formData.append("model_id", modelId);
      formData.append("file", audioBlob, `audio.${getAudioExtension(mimeType)}`);

      const sttResponse = await fetch(`${API_BASE}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: formData,
      });

      if (!sttResponse.ok) {
        const err = await sttResponse.text();
        return res.status(sttResponse.status).json({ error: err || "STT request failed" });
      }

      const payload = await sttResponse.json();
      return res.status(200).json({ text: extractText(payload) });
    } catch (error) {
      return res.status(500).json({ error: String(error) });
    }
  });
}
