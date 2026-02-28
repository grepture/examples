import { useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

const DEFAULT_PROMPT = `Summarize this customer record and add a short greeting:

Name: Sarah Chen
Email: sarah.chen@acme.com
Phone: (415) 555-0142
SSN: 521-44-8832
Address: 742 Evergreen Terrace, Springfield, IL 62704`;

export default function App() {
  const [greptureKey, setGreptureKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setLoading(true);
    setError("");
    setResponse("");

    try {
      const PROXY_URL = "https://proxy.grepture.com";

      // Custom fetch that routes through the Grepture proxy.
      // Google's SDK uses x-goog-api-key for auth (not Authorization),
      // so we forward it explicitly via X-Grepture-Auth-Forward.
      const proxyFetch: typeof fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        const parsed = new URL(url);
        const proxyUrl = `${PROXY_URL}/proxy${parsed.pathname}${parsed.search}`;

        const headers = new Headers(init?.headers);

        const googleApiKey = headers.get("x-goog-api-key");
        if (googleApiKey) {
          headers.set("X-Grepture-Auth-Forward", `Bearer ${googleApiKey}`);
        }

        headers.set("Authorization", `Bearer ${greptureKey}`);
        headers.set("X-Grepture-Target", url);

        return globalThis.fetch(proxyUrl, { ...init, headers });
      };

      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { fetch: proxyFetch },
      });

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      setResponse(result.text ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-accent font-bold">[grepture]</span>
          <span className="text-muted-foreground">+</span>
          <span className="font-semibold">Gemini Example</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grepture-key">Grepture API Key</Label>
              <Input
                id="grepture-key"
                type="password"
                placeholder="grp-..."
                value={greptureKey}
                onChange={(e) => setGreptureKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="AI..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !greptureKey || !geminiKey}
            >
              {loading ? "Sending..." : "Send"}
            </Button>
          </CardContent>
        </Card>

        {(response || error) && (
          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-destructive">{error}</p>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{response}</pre>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
