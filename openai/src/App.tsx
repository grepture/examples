import { useState } from "react";
import OpenAI from "openai";
import { Grepture } from "@grepture/sdk";
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
  const [openaiKey, setOpenaiKey] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setLoading(true);
    setError("");
    setResponse("");

    try {
      const grepture = new Grepture({
        apiKey: greptureKey,
        proxyUrl: "https://proxy.grepture.com",
      });

      const options = grepture.clientOptions({
        apiKey: openaiKey,
        baseURL: "https://api.openai.com/v1",
      });

      const client = new OpenAI({
        ...options,
        dangerouslyAllowBrowser: true, // just for demo purposes!
      });

      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      let text = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          text += delta;
          setResponse(text);
        }
      }
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
          <span className="font-semibold">OpenAI Example</span>
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
              <Label htmlFor="openai-key">OpenAI API Key</Label>
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
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
              disabled={loading || !greptureKey || !openaiKey}
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
