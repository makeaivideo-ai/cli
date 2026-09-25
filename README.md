# @makeaivideo/cli

Make short-form AI videos from your terminal. Brief in, finished MP4 out.

```bash
npx @makeaivideo/cli login
makeaivideo tools
makeaivideo create explainer --topic "Why planes leave white trails" --wait --out trails.mp4
```

Zero runtime dependencies (Node 18+). Every command prints JSON with `--json` (automatic when
piped), so it works as a tool for Claude, Cursor and CI as well as for people.

## Install

```bash
npm i -g @makeaivideo/cli     # or just use npx @makeaivideo/cli
```

## Log in

`makeaivideo login` opens app.makeaivideo.ai, you confirm a short code, and a scoped API key is
saved to `~/.makeaivideo/config.json` (mode 600). Revoke it any time under Settings, Advanced,
API keys.

Headless environments skip login: `export MAKEAIVIDEO_API_KEY=mav_...`.

## Commands

Every command prints JSON. Ids are the public ids the API returns (`vid_…`, `wh_…`).

| Area | Commands |
| --- | --- |
| Account | `login`, `logout`, `whoami`, `credits`, `workspace [--name --aspect --style]` |
| Make a video | `tools`, `estimate <tool>`, `create <tool> --<field> …` (`--duration --aspect --language --draft --wait --out --idempotency-key`), `create --script f.json [--mode --voice-id --music-id --character-id]` |
| Scripts | `script --topic "…"` or `script --tool explainer --field-topic "…"`, `scriptify <file.txt>`, `fetch-url <url>` |
| Track and fetch | `videos`, `status <id>`, `wait <id> [--out f]`, `download <id> [--out f]`, `captions <id> [--format vtt] [--out f]`, `share <id> [--expires s]` |
| Edit and redo | `update <id> [--title --topic --script f.json --caption-style]`, `generate <id>`, `scene-regen <id> <n> [--narration]`, `voice <id> --voice-id v`, `export <id>`, `renders <id>`, `render-progress <id>` |
| Manage | `cancel <id>`, `delete <id>`, `report <id> --reason "…"` |
| Ideas | `ideas --niche "…" [--audience --tone --count]`, `enhance --topic "…"` |
| Characters | `characters`, `character <id>`, `portraits --prompt "…" --style s`, `voice-previews`, `character-create --name --style --portrait --voice-preview --voice-id`, `character-delete <id>` |
| Assets | `upload <image…>`, `upload-url <image_url>`, `voices`, `voice-preview <id> [--text]`, `music`, `music-generate --prompt "…"`, `brand-kit [--show true]`, `brand-kit-watermark <png>`, `templates` |
| Webhooks | `webhooks`, `webhook-add <url> --events video.ready,video.failed`, `webhook-test <id>`, `webhook-deliveries <id>`, `webhook-enable <id>`, `webhook-rm <id>` |

Set `--idempotency-key <key>` on `create` so a retried command never makes (and charges for) a
second video.

## For AI agents

This package ships a Claude Code plugin (`.claude-plugin/plugin.json` + `SKILL.md`) and an
`.mcp.json` pointing at the hosted MCP server `https://mcp.makeaivideo.ai`. In
Claude.ai, ChatGPT or Cursor, add that URL as a custom connector and approve access in the
browser; no key to paste.

REST API spec: `https://app.makeaivideo.ai/api/v1/openapi.json`.

## Environment

- `MAKEAIVIDEO_API_KEY` overrides the saved login.
- `MAKEAIVIDEO_API_URL` points at another host (default `https://app.makeaivideo.ai`).

MIT

## About MakeAIVideo

[MakeAIVideo](https://makeaivideo.ai) is an AI video generator that turns a brief, a prompt or your own script into a finished, captioned short-form video: script, AI voiceover, AI-generated or stock scenes, captions and music, exported as an MP4 ready for TikTok, Instagram Reels and YouTube Shorts.

- **Make videos in the app:** [prompt to video](https://makeaivideo.ai/prompt-to-video), [script to video](https://makeaivideo.ai/script-to-video), [image to video](https://makeaivideo.ai/image-to-video), [talking avatar](https://makeaivideo.ai/talking-avatar), [AI ad maker](https://makeaivideo.ai/ai-ad-maker), [blog to video](https://makeaivideo.ai/blog-to-video)
- **By format:** [TikTok video generator](https://makeaivideo.ai/tiktok-video-generator), [Instagram Reels generator](https://makeaivideo.ai/instagram-reels-generator), [AI Shorts generator](https://makeaivideo.ai/ai-shorts-generator), [faceless YouTube channel](https://makeaivideo.ai/faceless-youtube-channel), [AI UGC video](https://makeaivideo.ai/ai-ugc-video), [AI explainer video](https://makeaivideo.ai/ai-explainer-video), [AI spokesperson video](https://makeaivideo.ai/ai-spokesperson-video)
- **For developers:** [developer hub](https://makeaivideo.ai/developers), [API reference](https://makeaivideo.ai/docs/api), [quickstart](https://makeaivideo.ai/docs/quickstart), [authentication](https://makeaivideo.ai/docs/authentication), [webhooks](https://makeaivideo.ai/docs/webhooks), [MCP server](https://makeaivideo.ai/docs/mcp), [AI agents](https://makeaivideo.ai/docs/agents), [CLI](https://makeaivideo.ai/docs/cli)
- **Compare:** [MakeAIVideo vs HeyGen](https://makeaivideo.ai/compare/heygen), [MakeAIVideo vs Synthesia](https://makeaivideo.ai/compare/synthesia)
- [Pricing](https://makeaivideo.ai/pricing) · [Free creator tools](https://makeaivideo.ai/tools) · [Blog](https://makeaivideo.ai/blog) · [Help](https://makeaivideo.ai/help) · [Contact](https://makeaivideo.ai/contact)

## Related packages

| Package | What it is |
| --- | --- |
| [`@makeaivideo/sdk`](https://github.com/makeaivideo-ai/sdk) | TypeScript / JavaScript SDK for the REST API |
| [`@makeaivideo/mcp`](https://github.com/makeaivideo-ai/mcp) | MCP server for Claude, ChatGPT, Cursor and other AI assistants |
| [`@makeaivideo/cli`](https://github.com/makeaivideo-ai/cli) | Command line tool: brief in, MP4 out |

## License

MIT © [MakeAIVideo](https://makeaivideo.ai)
