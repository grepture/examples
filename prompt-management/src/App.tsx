import { useState } from "react";
import OpenAI from "openai";
import { Grepture } from "@grepture/sdk";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

export default function App() {
  const [greptureKey, setGreptureKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [customerName, setCustomerName] = useState("Sarah Chen");
  const [issue, setIssue] = useState("I was charged twice for my subscription renewal last week.");
  const [tone, setTone] = useState("friendly");
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

      // Use a managed prompt — the proxy resolves the template server-side.
      // The prompt "standard-support-replies" is created in the Grepture dashboard
      // with variables like {{customer_name}}, {{issue}}, and {{tone}}.
      const messages = grepture.prompt.use("standard-support-replies", {
        variables: {
          customer_name: customerName,
          issue,
          tone,
        },
      });

      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: messages as OpenAI.ChatCompletionMessageParam[],
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
          <span className="font-semibold">Prompt Management Example</span>
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
            <CardTitle>Variables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              These values are passed to the managed prompt{" "}
              <code className="text-accent">standard-support-replies</code>.
              The proxy resolves the template server-side.
            </p>
            <div className="space-y-2">
              <Label htmlFor="customer-name">customer_name</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue">issue</Label>
              <Input
                id="issue"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">tone</Label>
              <Input
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              />
            </div>
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
