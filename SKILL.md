---
name: makeaivideo
description: Make short-form AI videos (TikTok, Reels, Shorts) from a brief. Use when the user asks to create, generate, render, check on, or download a video, estimate what a video will cost, post or schedule a video to TikTok, Instagram, YouTube or other connected social accounts, or list their videos, voices, characters or templates.
---

# MakeAIVideo

Turn a brief into a finished video through the MakeAIVideo CLI. Every command prints JSON.

**If MakeAIVideo MCP tools are available in this session, prefer them over the CLI.** They need
no local install and no key handling. The workflow below is the same either way:
`estimate_video_cost` maps to `estimate`, `create_<tool>_video` to `create <tool>`,
`get_video_status` to `status`, `get_download_url` to `download`.

## Setup (once)
- **Interactive:** `makeaivideo login` opens the browser; the user approves a short code and a key is saved locally.
- **Headless (CI, agents):** `export MAKEAIVIDEO_API_KEY=mav_...` (from app.makeaivideo.ai, Settings, Advanced, API keys).

Run with `npx @makeaivideo/cli <command>` (or `makeaivideo <command>` if installed).

## Always start here
1. `makeaivideo whoami` confirms the key works and shows credits remaining.
2. `makeaivideo tools` lists the create tools (explainer, listicle, story, ugc, demo, article, spokesperson) and the exact `--field` flags each one takes. Never guess field names.

## Core workflow
Quote first (free), then create, then wait, then download:
```bash
makeaivideo estimate explainer --duration 45
makeaivideo create explainer --topic "Why planes leave white trails" --duration 45 --wait --out trails.mp4
```
Without `--wait` the command returns `{ video_id, status: "generating", poll_after_seconds }` at once.
Renders take 2 to 6 minutes. Poll with `makeaivideo status <video_id>` no faster than
`poll_after_seconds`, or block with `makeaivideo wait <video_id> --out file.mp4`.

## Beyond the core loop
- **Own the script:** `script --topic "..."` writes it (JSON to stdout); edit the file; `create --script script.json --wait --out out.mp4`. Or `scriptify notes.txt` to structure prose you already have.
- **Fix one part, not the whole video:** `scene-regen <id> <n> --narration "..."`, `voice <id> --voice-id <v>`, then `export <id>` and `render-progress <id>`.
- **Don't poll if you can be told:** `webhook-add https://your.host/hook --events video.ready,video.failed` (save the secret; verify `X-MakeAIVideo-Signature` = sha256 HMAC of the raw body).
- **Characters:** `portraits --prompt "..." --style <s>` then `voice-previews`, then `character-create` with the chosen `r2_key` and temp key. Pass `--character-id` on create.
- **Post it:** `accounts` lists connected social accounts (`acc_...` ids). `publish <video_id> --accounts acc_1,acc_2 --caption "..."` posts now; add `--schedule <ISO-8601>` to schedule. Check with `post <post_id>` or `posts --video <video_id>`. To add an account, `connect <platform>` returns a link that the USER must open; you cannot finish it. Bluesky, Telegram and Discord connect in the web app only. X takes videos up to 140 seconds. Never guess account ids.
- **Captions and sharing:** `captions <id> --format vtt --out subs.vtt`; `share <id>` for a public expiring link.

## Rules
- **Creating spends credits.** Always run `estimate` (or `create --estimate`) and tell the user the cost before creating, unless they already agreed.
- **Retries:** pass `--idempotency-key <stable string>` on create. Re-sending the same key returns the same video instead of charging for a second one.
- **Errors** arrive on stderr as `{ "error", "code", "retryable" }`. Retry only when `retryable` is true. A `403` with code `forbidden` means the key lacks a scope; a `402` means no credits or no active plan: tell the user, do not loop.
- Recover ids with `makeaivideo videos`; never invent a `video_id`.
- `cancel <id>` stops a render that is still generating and releases its credits.
- Never print the API key back to the user.
