import { GoogleAuth } from "google-auth-library";
import axios from "axios";
import { homedir } from "os";
import { join } from "path";

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = join(
    homedir(), ".config", "gcloud", "application_default_credentials.json"
  );
}

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

// Gemini 3.1 Pro richiede location "global", gli altri "us-central1"
const MODEL_LOCATION = {
  "gemini-3.1-pro-preview": "global",
};

async function callVertex(model, contents, generationConfig = {}) {
  const project  = process.env.VERTEX_PROJECT;
  const token    = await auth.getAccessToken();
  const location = MODEL_LOCATION[model] || "us-central1";
  const base     = location === "global"
    ? "https://aiplatform.googleapis.com"
    : `https://${location}-aiplatform.googleapis.com`;

  const url = `${base}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const resp = await axios.post(url, { contents, generationConfig },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 120000 }
  );

  return resp.data.candidates[0].content.parts[0].text;
}

export async function vertexGenerate(model, prompt, config = {}) {
  return callVertex(
    model,
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.8, maxOutputTokens: 16384, ...config },
  );
}

export async function vertexGenerateJSON(model, prompt) {
  const text = await callVertex(
    model,
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.7, responseMimeType: "application/json" },
  );
  return JSON.parse(text);
}
