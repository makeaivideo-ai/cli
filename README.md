# MakeAIVideo CLI (`@makeaivideo/cli`)

[![npm version](https://img.shields.io/npm/v/@makeaivideo/cli.svg)](https://www.npmjs.com/package/@makeaivideo/cli) [![license: MIT](https://img.shields.io/npm/l/@makeaivideo/cli.svg)](LICENSE) [![node](https://img.shields.io/node/v/@makeaivideo/cli.svg)](https://nodejs.org)

**The MakeAIVideo CLI makes AI videos from your terminal: give it a brief or a script and it returns a finished MP4 with AI voiceover, AI or stock scenes, captions and music, then posts or schedules it to your connected TikTok, Instagram, YouTube and other social accounts.**

[MakeAIVideo](https://makeaivideo.ai) is an AI video generator for short-form video. This CLI is a thin client for its [REST API](https://makeaivideo.ai/docs/api) ([CLI guide](https://makeaivideo.ai/docs/cli)).

```bash
npx @makeaivideo/cli login
makeaivideo tools
makeaivideo create explainer --topic "Why planes leave white trails" --wait --out trails.mp4
makeaivideo publish <video_id> --accounts acc_123 --caption "Why planes leave white trails"
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
| Post to social | `accounts`, `connect <platform>`, `publish <id> --accounts acc_1,acc_2 --caption "…" [--schedule <ISO-8601> --timezone --youtube-title --idempotency-key]`, `posts [--video <id>]`, `post <post_id>` |
| Webhooks | `webhooks`, `webhook-add <url> --events video.ready,video.failed`, `webhook-test <id>`, `webhook-deliveries <id>`, `webhook-enable <id>`, `webhook-rm <id>` |

Set `--idempotency-key <key>` on `create` so a retried command never makes (and charges for) a
second video. The same flag on `publish` stops a retry from posting twice.

## Post to social accounts

```bash
makeaivideo accounts                          # connected accounts and their acc_... ids
makeaivideo connect tiktok                    # prints a link: open it in a browser to connect
makeaivideo publish vid_abc --accounts acc_1,acc_2 --caption "New video" --schedule 2026-10-01T09:00:00Z
makeaivideo post <post_id>                    # status and per-platform results
```

TikTok, Instagram (as a Reel), YouTube (9:16 as a Short), Facebook Pages, LinkedIn, Threads and
Pinterest connect by link. Bluesky, Telegram and Discord connect in the
[web app](https://app.makeaivideo.ai). X is not supported. More at
[makeaivideo.ai/auto-post](https://makeaivideo.ai/auto-post).

## For AI agents

This package ships a Claude Code plugin (`.claude-plugin/plugin.json` + `SKILL.md`) and an
`.mcp.json` pointing at the hosted MCP server `https://mcp.makeaivideo.ai`. In
Claude.ai, ChatGPT or Cursor, add that URL as a custom connector and approve access in the
browser; no key to paste.

REST API spec: `https://app.makeaivideo.ai/api/v1/openapi.json`.

## Environment

- `MAKEAIVIDEO_API_KEY` overrides the saved login.
- `MAKEAIVIDEO_API_URL` points at another host (default `https://app.makeaivideo.ai`).

## What you can make with MakeAIVideo

MakeAIVideo turns almost any starting point into a finished short-form video. Start from a single idea with [prompt to video](https://makeaivideo.ai/prompt-to-video), or bring your own words with [script to video](https://makeaivideo.ai/script-to-video) and [blog to video](https://makeaivideo.ai/blog-to-video), which narrates a blog post you paste in. To teach a topic, [AI explainer videos](https://makeaivideo.ai/ai-explainer-video) add voiceover, scenes, captions and music in one pass.

For a presenter on screen, [AI talking avatar videos](https://makeaivideo.ai/talking-avatar) lip-sync a presenter you pick, or one made from your own reference photo, to a script. [AI spokesperson videos](https://makeaivideo.ai/ai-spokesperson-video) suit corporate messaging you want to re-render when details change, and [AI UGC video ads](https://makeaivideo.ai/ai-ugc-video) put an AI spokesperson on your ad script for Meta and TikTok. [Character swap](https://makeaivideo.ai/character-swap) replaces the person in a video you upload while the motion and audio stay as filmed.

From a still image, [image to video](https://makeaivideo.ai/image-to-video) turns product shots, landscapes and album art into a moving clip, and [animate a photo](https://makeaivideo.ai/animate-a-photo) brings portraits, pets and old family photos to life.

Every video is sized for short-form platforms: use the [TikTok video generator](https://makeaivideo.ai/tiktok-video-generator), the [Instagram Reels generator](https://makeaivideo.ai/instagram-reels-generator) or the [AI YouTube Shorts generator](https://makeaivideo.ai/ai-shorts-generator), or run a [faceless YouTube channel](https://makeaivideo.ai/faceless-youtube-channel) without filming. When a video is ready, [auto-post to social media](https://makeaivideo.ai/auto-post) posts or schedules it to TikTok, Instagram, YouTube, Facebook Pages, LinkedIn, Threads, Pinterest, Bluesky, Telegram and Discord (X is not supported). Plans and credits are on the [MakeAIVideo pricing page](https://makeaivideo.ai/pricing), and AI assistants connect through the [MakeAIVideo MCP server setup guide](https://makeaivideo.ai/docs/mcp).

From the terminal, `create` covers the brief-driven tools (explainer, listicle, story, UGC, demo, article and spokesperson) and your own scripts, and `publish` posts the result. The [API reference](https://makeaivideo.ai/docs/api) lists exactly what each endpoint accepts.

## FAQ

**What is the MakeAIVideo CLI?** An MIT-licensed command line client for the MakeAIVideo AI video generator. It creates finished short-form videos from a brief or script, downloads the MP4, and posts it to connected social accounts.

**How do I install it?** `npm i -g @makeaivideo/cli`, or run it without installing via `npx @makeaivideo/cli`. Node 18 or newer.

**Can Claude Code or another AI agent use it?** Yes. Every command prints JSON, and the package ships a Claude Code plugin (`SKILL.md`) plus an `.mcp.json` for the hosted MCP server `https://mcp.makeaivideo.ai`.

**Which platforms can it post to?** TikTok, Instagram, YouTube, Facebook Pages, LinkedIn, Threads, Pinterest, Bluesky, Telegram and Discord. X is not supported.

**How is it priced?** MakeAIVideo is a paid product with monthly plans and a 7-day trial (card required). The CLI uses the same credits as the app; `estimate` quotes a video before you create it. See [pricing](https://makeaivideo.ai/pricing).

**Where do I get help?** Open an [issue](https://github.com/makeaivideo-ai/cli/issues) or email support@makeaivideo.ai.

## Links

- Website: [makeaivideo.ai](https://makeaivideo.ai)
- CLI guide: [makeaivideo.ai/docs/cli](https://makeaivideo.ai/docs/cli) · [makeaivideo.ai/cli](https://makeaivideo.ai/cli)
- Developer hub: [makeaivideo.ai/developers](https://makeaivideo.ai/developers)
- API reference: [makeaivideo.ai/docs/api](https://makeaivideo.ai/docs/api)
- OpenAPI spec: [app.makeaivideo.ai/api/v1/openapi.json](https://app.makeaivideo.ai/api/v1/openapi.json)
- MCP server: `https://mcp.makeaivideo.ai` ([setup guide](https://makeaivideo.ai/docs/mcp))
- API keys: [app.makeaivideo.ai/developers](https://app.makeaivideo.ai/developers)
- npm: [@makeaivideo/cli](https://www.npmjs.com/package/@makeaivideo/cli) · [@makeaivideo/sdk](https://www.npmjs.com/package/@makeaivideo/sdk) · [@makeaivideo/mcp](https://www.npmjs.com/package/@makeaivideo/mcp)
- GitHub: [makeaivideo-ai/cli](https://github.com/makeaivideo-ai/cli) · [makeaivideo-ai/sdk](https://github.com/makeaivideo-ai/sdk) · [makeaivideo-ai/mcp](https://github.com/makeaivideo-ai/mcp)
- Support: support@makeaivideo.ai

## About MakeAIVideo

[MakeAIVideo](https://makeaivideo.ai) is an AI video generator that turns a brief, a prompt, your own script, an image or a talking avatar into a finished, captioned short-form video: script, AI voiceover, AI-generated or stock scenes, captions and music, exported as an MP4 ready for TikTok, Instagram Reels and YouTube Shorts. It also does character swap, and posts or schedules videos to connected TikTok, Instagram, YouTube, Facebook Pages, LinkedIn, Threads, Pinterest, Bluesky, Telegram and Discord accounts. Operated by MintClips Ltd (UK).

- **For developers:** [developer hub](https://makeaivideo.ai/developers), [API reference](https://makeaivideo.ai/docs/api), [quickstart](https://makeaivideo.ai/docs/quickstart), [authentication](https://makeaivideo.ai/docs/authentication), [webhooks](https://makeaivideo.ai/docs/webhooks), [MCP server](https://makeaivideo.ai/docs/mcp), [AI agents](https://makeaivideo.ai/docs/agents), [SDK guide](https://makeaivideo.ai/docs/sdk), [CLI](https://makeaivideo.ai/docs/cli)
- **Compare:** [MakeAIVideo vs HeyGen](https://makeaivideo.ai/compare/heygen), [MakeAIVideo vs Synthesia](https://makeaivideo.ai/compare/synthesia)
- [Free creator tools](https://makeaivideo.ai/tools) · [Blog](https://makeaivideo.ai/blog) · [Help](https://makeaivideo.ai/help) · [Contact](https://makeaivideo.ai/contact)

## Related packages

| Package | What it is |
| --- | --- |
| [`@makeaivideo/sdk`](https://github.com/makeaivideo-ai/sdk) | TypeScript / JavaScript SDK for the REST API |
| [`@makeaivideo/mcp`](https://github.com/makeaivideo-ai/mcp) | MCP server for Claude, ChatGPT, Cursor and other AI assistants |
| [`@makeaivideo/cli`](https://github.com/makeaivideo-ai/cli) | Command line tool: brief in, MP4 out |

## License

MIT © [MakeAIVideo](https://makeaivideo.ai)
