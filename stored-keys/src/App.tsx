import { useState } from "react";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { Grepture } from "@grepture/sdk";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

type Provider = "openai" | "anthropic";

const DEFAULT_PROMPT = "Give me a single-sentence fun fact about octopuses.";

const TOOL_CALL_PROMPT =
  "What's the weather like in San Francisco right now? Use the get_weather tool.";

const WEATHER_TOOL_OPENAI: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_weather",
    description: "Get the current weather for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name, e.g. San Francisco" },
      },
      required: ["location"],
    },
  },
};

const WEATHER_TOOL_ANTHROPIC: Anthropic.Tool = {
  name: "get_weather",
  description: "Get the current weather for a given location.",
  input_schema: {
    type: "object" as const,
    properties: {
      location: { type: "string", description: "City name, e.g. San Francisco" },
    },
    required: ["location"],
  },
};

export default function App() {
  const [greptureKey, setGreptureKey] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [withTools, setWithTools] = useState(false);
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
        proxyUrl: "http://localhost:4001",
        // proxyUrl: "https://proxy.grepture.com",
      });

      if (provider === "openai") {
        await runOpenAI(grepture);
      } else {
        await runAnthropic(grepture);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[stored-keys] error:", err);
      setError(msg || `Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function runOpenAI(grepture: Grepture) {
    // ── The magic: omit apiKey. The proxy resolves your team's stored
    //    OpenAI key (and any fallback chain you've configured).
    const options = grepture.clientOptions({
      baseURL: "https://api.openai.com/v1",
    });

    const client = new OpenAI({
      ...options,
      dangerouslyAllowBrowser: true, // just for demo purposes!
    });

    const requestPrompt = withTools ? TOOL_CALL_PROMPT : prompt;

    if (withTools) {
      // Use raw fetch to bypass SDK parsing — lets us see exactly what the
      // proxy returns (helpful when cross-provider translation is involved).
      const res = await fetch("http://localhost:4001/proxy/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${greptureKey}`,
          "X-Grepture-Target": "https://api.openai.com/v1/chat/completions",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: requestPrompt }],
          tools: [WEATHER_TOOL_OPENAI],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? JSON.stringify(json));
      }

      const choice = json.choices?.[0];
      let text = choice?.message?.content ?? "";

      if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          text += `\n> ${tc.function.name}(${tc.function.arguments})`;
        }
      }
      setResponse(text || JSON.stringify(json, null, 2));
    } else {
      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: requestPrompt }],
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
    }
  }

  async function runAnthropic(grepture: Grepture) {
    const options = grepture.clientOptions({
      baseURL: "https://api.anthropic.com",
    });

    const client = new Anthropic({
      ...options,
      dangerouslyAllowBrowser: true, // just for demo purposes!
    });

    const requestPrompt = withTools ? TOOL_CALL_PROMPT : prompt;

    if (withTools) {
      const res = await fetch("http://localhost:4001/proxy/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${greptureKey}`,
          "X-Grepture-Target": "https://api.anthropic.com/v1/messages",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          messages: [{ role: "user", content: requestPrompt }],
          tools: [WEATHER_TOOL_ANTHROPIC],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? JSON.stringify(json));
      }

      let text = "";
      if (Array.isArray(json.content)) {
        for (const block of json.content) {
          if (block.type === "text") text += block.text;
          if (block.type === "tool_use") {
            text += `\n> ${block.name}(${JSON.stringify(block.input)})`;
          }
        }
      }
      setResponse(text || JSON.stringify(json, null, 2));
    } else {
      const stream = client.messages.stream({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: requestPrompt }],
      });

      let text = "";
      stream.on("text", (delta) => {
        text += delta;
        setResponse(text);
      });

      await stream.finalMessage();
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-accent font-bold">[grepture]</span>
          <span className="text-muted-foreground">+</span>
          <span className="font-semibold">Stored Provider Keys</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How this works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This demo does <span className="text-foreground font-medium">not</span>{" "}
              ask you for an OpenAI or Anthropic key. Instead, configure them in
              the Grepture dashboard at{" "}
              <span className="text-foreground font-mono">Settings → API → Provider Keys</span>.
            </p>
            <p>
              When you send a request, the proxy automatically resolves your stored
              key for the detected provider. If you've configured a fallback chain
              (e.g. primary OpenAI → backup Anthropic), the proxy will transparently
              retry on 5xx errors — even across providers, with on-the-fly request and
              response translation.
            </p>
            <p className="text-xs">
              The only code change vs. passing your own key:{" "}
              <span className="font-mono text-foreground">
                grepture.clientOptions({"{"}baseURL{"}"})
              </span>{" "}
              — no <span className="font-mono text-foreground">apiKey</span> field at all.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grepture API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grepture-key">Your Grepture API Key</Label>
              <Input
                id="grepture-key"
                type="password"
                placeholder="grp-..."
                value={greptureKey}
                onChange={(e) => setGreptureKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This is the only key in your client code. Your provider keys
                stay encrypted in Grepture's database.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="flex gap-2">
                <Button
                  variant={provider === "openai" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProvider("openai")}
                  type="button"
                >
                  OpenAI
                </Button>
                <Button
                  variant={provider === "anthropic" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProvider("anthropic")}
                  type="button"
                >
                  Anthropic
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={withTools ? TOOL_CALL_PROMPT : prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={withTools}
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={withTools}
                onChange={(e) => setWithTools(e.target.checked)}
                className="accent-accent h-4 w-4 rounded"
              />
              <span>
                Include tool calls{" "}
                <span className="text-muted-foreground">
                  (sends a <span className="font-mono">get_weather</span> tool definition)
                </span>
              </span>
            </label>

            <Button onClick={handleSend} disabled={loading || !greptureKey}>
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
                <p className="text-destructive text-sm">{error}</p>
              ) : (
                <>
                  <pre className="whitespace-pre-wrap text-sm">{response}</pre>
                  <p className="mt-3 text-xs text-muted-foreground">
                    To see which stored key actually served this request (primary
                    or fallback), check Traffic Logs in the Grepture dashboard.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
