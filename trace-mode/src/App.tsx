import { useState } from "react";
import OpenAI from "openai";
import { Grepture } from "@grepture/sdk";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

const PROMPT = "Explain what a TCP handshake is in exactly two sentences.";

type RunResult = {
  mode: "proxy" | "trace";
  durationMs: number;
  response: string;
  flushed?: boolean;
};

export default function App() {
  const [greptureKey, setGreptureKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [results, setResults] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runRequest(mode: "proxy" | "trace"): Promise<RunResult> {
    const grepture = new Grepture({
      apiKey: greptureKey,
      proxyUrl: "https://proxy.grepture.com",
      mode,
    });

    const client = new OpenAI({
      ...grepture.clientOptions({
        apiKey: openaiKey,
        baseURL: "https://api.openai.com/v1",
      }),
      dangerouslyAllowBrowser: true,
    });

    const start = performance.now();

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: PROMPT }],
    });

    const durationMs = Math.round(performance.now() - start);
    const response = res.choices[0]?.message?.content ?? "";

    // In trace mode, flush pending traces before reporting
    await grepture.flush();

    return { mode, durationMs, response, flushed: mode === "trace" };
  }

  async function handleRun() {
    setLoading(true);
    setError("");
    setResults([]);

    try {
      // Run proxy first, then trace, so the comparison is fair
      // (both benefit equally from any OpenAI-side caching)
      const proxyResult = await runRequest("proxy");
      setResults([proxyResult]);

      const traceResult = await runRequest("trace");
      setResults([proxyResult, traceResult]);
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
          <span className="font-semibold">Trace Mode</span>
        </div>

        <p className="text-sm text-muted-foreground">
          Compare proxy mode (requests route through Grepture) vs trace mode
          (requests go directly to OpenAI, traces sent async). Both produce
          entries in your dashboard &mdash; trace mode just skips the proxy hop.
        </p>

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
            <CardTitle>Run Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Sends the same prompt (<code>"{PROMPT}"</code>) twice &mdash; once
              through the proxy, once directly via trace mode &mdash; and
              compares end-to-end latency.
            </p>
            <Button
              onClick={handleRun}
              disabled={loading || !greptureKey || !openaiKey}
            >
              {loading ? "Running..." : "Run both modes"}
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span
                      className={
                        r.mode === "trace"
                          ? "text-accent"
                          : "text-muted-foreground"
                      }
                    >
                      {r.mode === "proxy" ? "Proxy mode" : "Trace mode"}
                    </span>
                    <span className="ml-auto tabular-nums text-sm">
                      {r.durationMs}ms
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {r.response}
                  </pre>
                  {r.flushed && (
                    <p className="text-xs text-accent">
                      Trace data flushed to dashboard
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {results.length === 2 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Latency difference
                    </span>
                    <span className="tabular-nums font-semibold">
                      {results[0].durationMs - results[1].durationMs > 0
                        ? `Trace mode ${results[0].durationMs - results[1].durationMs}ms faster`
                        : results[0].durationMs - results[1].durationMs < 0
                          ? `Proxy mode ${results[1].durationMs - results[0].durationMs}ms faster`
                          : "Same latency"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Proxy mode (default)</p>
              <p>
                SDK &rarr; Grepture proxy &rarr; OpenAI &rarr; proxy &rarr; SDK
              </p>
              <p>Rules, PII redaction, and blocking run on every request.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-accent">Trace mode</p>
              <p>SDK &rarr; OpenAI (direct)</p>
              <p>
                Trace data (tokens, model, latency) sent async to Grepture in
                the background. Zero latency overhead, full dashboard visibility.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
