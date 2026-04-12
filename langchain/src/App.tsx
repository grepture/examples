import { useState, useRef } from "react";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Grepture } from "@grepture/sdk";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

type Step = {
  name: string;
  status: "pending" | "running" | "done" | "error";
  result?: string;
};

const PIPELINE_STEPS = [
  {
    name: "Extract key facts",
    label: "extract-facts",
    prompt:
      "Extract the key facts from this customer support ticket as a JSON object with fields: customer_name, issue, product, sentiment, urgency (low/medium/high).\n\nTicket: My name is Alex Rivera. I purchased the ProMax 3000 blender last week (Order #PM-8842) and the motor already burned out while making a smoothie. This is the second defective unit I've received. I need a replacement shipped overnight or a full refund. I'm extremely frustrated with the quality.",
  },
  {
    name: "Draft response",
    label: "draft-response",
    system: "You are a customer support agent. Write empathetic, concise responses.",
    promptFn: (prev: string) =>
      `Based on these extracted facts, draft a customer support response email. Be empathetic and offer a concrete resolution.\n\nFacts:\n${prev}`,
  },
  {
    name: "Compliance check",
    label: "compliance-check",
    system:
      "You are a compliance reviewer. Check customer communications for policy violations. Respond with PASS or FAIL and a brief explanation.",
    promptFn: (prev: string) =>
      `Review this customer support email draft for compliance issues (promises we can't keep, sharing internal info, missing required disclaimers):\n\n${prev}`,
  },
];

export default function App() {
  const [greptureKey, setGreptureKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(false);

  async function handleRun() {
    abortRef.current = false;
    setLoading(true);
    setError("");

    const newTraceId = `ticket-${crypto.randomUUID().slice(0, 8)}`;
    setTraceId(newTraceId);

    const initialSteps: Step[] = PIPELINE_STEPS.map((s) => ({
      name: s.name,
      status: "pending",
    }));
    setSteps(initialSteps);

    try {
      const grepture = new Grepture({
        apiKey: greptureKey,
        proxyUrl: "https://proxy.grepture.com",
      });
      grepture.setTraceId(newTraceId);

      // Attach metadata to every request in this trace
      grepture.setMetadata({ pipeline: "support-ticket", source: "langchain-example" });

      const opts = grepture.clientOptions({
        apiKey: openaiKey,
        baseURL: "https://api.openai.com/v1",
      });

      const model = new ChatOpenAI({
        model: "gpt-4o",
        apiKey: opts.apiKey,
        configuration: {
          baseURL: opts.baseURL,
          fetch: opts.fetch,
        },
      });

      let previousResult = "";

      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        if (abortRef.current) break;

        const step = PIPELINE_STEPS[i];

        setSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s)),
        );

        const userContent =
          "promptFn" in step && step.promptFn
            ? step.promptFn(previousResult)
            : step.prompt!;

        // Label each request so it's identifiable inside the trace
        grepture.setLabel(step.label);

        const messages = [];
        if ("system" in step && step.system) {
          messages.push(new SystemMessage(step.system));
        }
        messages.push(new HumanMessage(userContent));

        const response = await model.invoke(messages);

        const result = typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
        previousResult = result;

        // Log a custom event marking step completion
        grepture.log(`${step.label}-done`, { chars: result.length });

        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done", result } : s,
          ),
        );
      }

      // Flush to ensure all log events are sent
      await grepture.flush();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error" } : s,
        ),
      );
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
          <span className="font-semibold">LangChain Example</span>
        </div>

        <p className="text-sm text-muted-foreground">
          This example runs a 3-step AI pipeline using LangChain&apos;s{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">ChatOpenAI</code>{" "}
          and groups all requests under a single trace with labels, metadata,
          and custom log events. View the trace in your Grepture dashboard
          under Traffic Log &rarr; Traces.
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
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {traceId && (
              <div className="flex items-center gap-2 rounded border border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground">Trace ID:</span>
                <code className="text-accent">{traceId}</code>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleRun}
                disabled={loading || !greptureKey || !openaiKey}
              >
                {loading ? "Running..." : "Run pipeline"}
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {PIPELINE_STEPS.map((s, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span>&rarr;</span>}
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <StepIndicator status={step.status} />
                    <span className="text-xs uppercase tracking-wider">
                      Step {i + 1}
                    </span>
                    <span className="text-muted-foreground">&middot;</span>
                    {step.name}
                  </CardTitle>
                </CardHeader>
                {step.result && (
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {step.result}
                    </pre>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ status }: { status: Step["status"] }) {
  if (status === "pending")
    return <span className="inline-block size-2 rounded-full bg-muted" />;
  if (status === "running")
    return (
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
    );
  if (status === "done")
    return <span className="inline-block size-2 rounded-full bg-accent" />;
  return <span className="inline-block size-2 rounded-full bg-destructive" />;
}
