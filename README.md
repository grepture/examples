# Grepture Examples

Interactive demos showing how to route AI provider traffic through [Grepture](https://grepture.com).

Each example is a standalone Vite + React app. API keys are entered in the browser — nothing is stored or processed server-side.
Please remove `dangerouslyAllowBrowser: true` from the options before using in production!

## Examples

| Folder | Provider | SDK |
| --- | --- | --- |
| `openai/` | OpenAI | `openai` + `@grepture/sdk` |
| `anthropic/` | Anthropic | `@anthropic-ai/sdk` + `@grepture/sdk` |
| `gemini/` | Google Gemini | `@google/genai` (custom fetch) |
| `vercel-ai-sdk/` | Vercel AI SDK | `ai` + `@ai-sdk/openai` + `@grepture/sdk` |

## Running

```bash
cd openai   # or anthropic, gemini
npm install
npm run dev
```

Open `http://localhost:5173`, enter your Grepture and provider API keys, and send a prompt.

## What it demonstrates

Each example sends a prompt containing fake PII (name, email, phone, SSN, address) through the Grepture proxy. If you have redaction rules configured, you'll see the PII stripped from the request before it reaches the AI provider.
