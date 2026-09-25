#!/usr/bin/env node
/**
 * makeaivideo — the MakeAIVideo CLI.
 *
 * Log in once (`makeaivideo login`), then turn a brief into a finished video:
 * `makeaivideo create explainer --topic "..." --wait --out video.mp4`.
 *
 * Agent-friendly: pass --json (or pipe to a non-TTY) and every command emits
 * structured JSON so Claude, Cursor and CI can parse results.
 *
 * Auth resolves from (1) MAKEAIVIDEO_API_KEY, else (2) the key saved by
 * `makeaivideo login` at ~/.makeaivideo/config.json (chmod 600).
 *
 * Zero runtime dependencies: pure Node (>=18) so `npx @makeaivideo/cli` is
 * instant and adds no supply-chain surface.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BASE = (process.env.MAKEAIVIDEO_API_URL || 'https://app.makeaivideo.ai').replace(/\/$/, '');
const VERSION = '0.2.0'; // keep in sync with package.json (sent as User-Agent)
const CONFIG_DIR = path.join(os.homedir(), '.makeaivideo');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const WANT_JSON = process.argv.includes('--json') || !process.stdout.isTTY;
const TTY = !!process.stdout.isTTY;

// ─── output ──────────────────────────────────────────────
const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const paint = (s: string, code: string) => (TTY ? `${code}${s}${C.reset}` : s);
function outJson(data: unknown) { process.stdout.write(JSON.stringify(data, null, 2) + '\n'); }
function say(msg = '') { process.stdout.write(msg + '\n'); }
function fail(message: string, extra: Record<string, unknown> = {}, code = 1): never {
  if (WANT_JSON) process.stderr.write(JSON.stringify({ error: message, ...extra }) + '\n');
  else process.stderr.write(paint('✖ ' + message, C.red) + '\n');
  process.exit(code);
}

// ─── config / auth ───────────────────────────────────────
interface Config { api_key?: string; email?: string; organization_id?: number }
function loadConfig(): Config { try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; } }
function saveConfig(cfg: Config) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
    try { fs.chmodSync(CONFIG_PATH, 0o600); } catch { /* non-POSIX */ }
  } catch (e) { fail(`Could not save credentials to ${CONFIG_PATH}: ${e instanceof Error ? e.message : String(e)}`); }
}
function resolveKey(): string { return process.env.MAKEAIVIDEO_API_KEY || loadConfig().api_key || ''; }

// ─── http ────────────────────────────────────────────────
type ApiErr = { message: string; code?: string; retryable?: boolean; details?: unknown };
// v1 envelope. `error` is normally an object; the auth layer can answer with
// the app's plain shape ({ error: string, code }) so both are accepted.
type Envelope<T> = { data: T | null; error: ApiErr | string | null; code?: string; requestId?: string };
function errOf(json: Envelope<unknown> | undefined, status: number): ApiErr | null {
  if (!json?.error) return null;
  if (typeof json.error === 'string') return { message: json.error, code: json.code, retryable: status >= 500 || status === 429 };
  return json.error;
}

async function raw<T = unknown>(method: string, p: string, body?: unknown, key?: string): Promise<{ status: number; json: Envelope<T> }> {
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': `makeaivideo-cli/${VERSION}` };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let resp: Response;
  try {
    resp = await fetch(`${BASE}${p}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    return fail(`Network error reaching ${BASE}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const json = (await resp.json().catch(() => ({ data: null, error: { message: `HTTP ${resp.status}` } }))) as Envelope<T>;
  if (!resp.ok && !json.error) json.error = { message: `HTTP ${resp.status}` };
  return { status: resp.status, json };
}

/** Authenticated v1 call. Unwraps { data, error }; fails cleanly on error. */
async function api<T = any>(method: string, p: string, body?: unknown): Promise<T> {
  const key = resolveKey();
  if (!key || !key.startsWith('mav_')) {
    fail('Not logged in. Run `makeaivideo login` (or set MAKEAIVIDEO_API_KEY=mav_...).');
  }
  const { status, json } = await raw<T>(method, `/api/v1${p}`, body, key);
  const err = errOf(json, status);
  if (err) fail(err.message || `API error (${status})`, { code: err.code, retryable: err.retryable, details: err.details, status });
  return json.data as T;
}

// ─── helpers ─────────────────────────────────────────────
const csv = (v: unknown): string[] => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') continue;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

function openBrowser(url: string) {
  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch { /* the URL is always printed too */ }
}

// ─── files ───────────────────────────────────────────────
function readJsonFile(p: string): unknown {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fail(`Could not read JSON from ${p}: ${e instanceof Error ? e.message : String(e)}`); }
}
/** Authenticated multipart upload to a v1 endpoint (field name + local paths). */
async function upload(p: string, field: string, paths: string[]): Promise<any> {
  const key = resolveKey();
  if (!key) fail('Not logged in. Run `makeaivideo login` (or set MAKEAIVIDEO_API_KEY=mav_...).');
  const form = new FormData();
  for (const fp of paths) {
    if (!fs.existsSync(fp)) fail(`No such file: ${fp}`);
    form.append(field, new Blob([fs.readFileSync(fp)]), path.basename(fp));
  }
  const resp = await fetch(`${BASE}/api/v1${p}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'User-Agent': `makeaivideo-cli/${VERSION}` }, body: form });
  const json = (await resp.json().catch(() => ({}))) as Envelope<unknown>;
  const err = errOf(json, resp.status);
  if (err) fail(err.message, { code: err.code, status: resp.status });
  return json.data;
}

// ─── login (device-grant flow) ───────────────────────────
async function login() {
  if (resolveKey() && !process.env.MAKEAIVIDEO_API_KEY) {
    const who = loadConfig().email;
    say(paint(`Already logged in${who ? ` as ${who}` : ''}. Run \`makeaivideo logout\` first to switch accounts.`, C.yellow));
    return;
  }
  const start = await raw<any>('POST', '/api/v1/auth/device', { client_name: `CLI on ${os.hostname()}` });
  if (start.json?.error || !start.json?.data) fail(errOf(start.json, start.status)?.message || 'Could not start login.');
  const { device_code, user_code, verification_uri, verification_uri_complete, interval } = start.json.data;

  if (WANT_JSON) {
    outJson({ status: 'pending', user_code, verification_uri, verification_uri_complete });
  } else {
    say('');
    say(`  ${paint('Connect this CLI to MakeAIVideo', C.bold)}`);
    say('');
    say(`  1. Open: ${paint(verification_uri, C.cyan)}`);
    say(`  2. Enter code: ${paint(user_code, C.bold)}`);
    say('');
    say(paint('  Opening your browser…', C.dim));
    openBrowser(verification_uri_complete);
    say(paint('  Waiting for you to approve…  (Ctrl-C to cancel)', C.dim));
  }

  let delay = Math.max(2, Number(interval) || 5) * 1000;
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(delay);
    const { json } = await raw<any>('POST', '/api/v1/auth/device/token', { device_code });
    if (json?.error) fail(errOf(json, 0)?.message || 'Login failed.');
    const d = json?.data || {};
    switch (d.status) {
      case 'pending': continue;
      case 'slow_down': delay += 2000; continue;
      case 'denied': fail('Login was denied in the browser.');
      case 'expired': fail('The login code expired. Run `makeaivideo login` again.');
      case 'authorized': {
        saveConfig({ api_key: d.api_key, email: d.user?.email, organization_id: d.organization_id });
        if (WANT_JSON) return outJson({ status: 'authorized', email: d.user?.email, organization_id: d.organization_id, scopes: d.scopes });
        say('');
        say(paint(`  ✓ Logged in as ${d.user?.email || 'your account'}`, C.green));
        say(paint(`  Credentials saved to ${CONFIG_PATH}`, C.dim));
        say('');
        say('  Next: `makeaivideo tools` to see what you can make, then');
        say('        `makeaivideo create explainer --topic "..." --wait --out video.mp4`');
        return;
      }
      default: continue;
    }
  }
  fail('Timed out waiting for approval. Run `makeaivideo login` again.');
}

function logout() {
  try { fs.rmSync(CONFIG_PATH, { force: true }); } catch { /* nothing to remove */ }
  if (WANT_JSON) return outJson({ ok: true });
  say(paint('✓ Logged out. Credentials removed.', C.green));
}

// ─── videos ──────────────────────────────────────────────
const TERMINAL = new Set(['ready', 'failed']); // video_status enum; a cancel ends as failed

async function waitFor(videoId: string, opts: { quiet?: boolean } = {}): Promise<any> {
  const deadline = Date.now() + 40 * 60 * 1000;
  let last = '';
  while (Date.now() < deadline) {
    const v = await api<any>('GET', `/videos/${encodeURIComponent(videoId)}`);
    if (TERMINAL.has(v.status)) return v;
    const note = v.progress?.note || v.status;
    if (!WANT_JSON && !opts.quiet && note !== last) { say(paint(`  ${note}`, C.dim)); last = note; }
    await sleep(Math.max(5, Number(v.poll_after_seconds) || 30) * 1000);
  }
  fail(`Timed out waiting for ${videoId}. Check later with \`makeaivideo status ${videoId}\`.`);
}

async function download(videoId: string, out?: string): Promise<string> {
  const d = await api<any>('GET', `/videos/${encodeURIComponent(videoId)}/download`);
  const file = out || `${videoId}.mp4`;
  const resp = await fetch(d.download_url);
  if (!resp.ok || !resp.body) fail(`Download failed (HTTP ${resp.status}).`);
  await pipeline(Readable.fromWeb(resp.body as any), fs.createWriteStream(file));
  return path.resolve(file);
}

async function create(positional: string[], flags: Record<string, string | boolean>) {
  const tool = positional[0];
  const scriptFile = typeof flags.script === 'string' ? flags.script : null;
  if (!tool && !scriptFile) fail('Usage: makeaivideo create <tool> --<field> "value" [--duration 45] [--aspect 9:16] [--wait] [--out file.mp4]\n       makeaivideo create --script script.json [--mode cinematic] [--voice-id v] [--wait]\nRun `makeaivideo tools` to see tools and their fields.');
  const reserved = new Set(['duration', 'aspect', 'language', 'idempotency-key', 'wait', 'out', 'estimate', 'script', 'mode', 'voice-id', 'music-id', 'character-id', 'draft', 'title']);
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (reserved.has(k) || typeof v !== 'string') continue;
    fields[k.replace(/-/g, '_')] = v;
  }
  const body: Record<string, unknown> = scriptFile
    ? { script: readJsonFile(scriptFile), mode: flags.mode, voice_id: flags['voice-id'], music_id: flags['music-id'], character_id: typeof flags['character-id'] === 'string' ? Number(flags['character-id']) : undefined, title: flags.title }
    : { tool, fields };
  if (flags.draft) body.start_generation = false;
  if (typeof flags.duration === 'string') body.duration_seconds = Number(flags.duration);
  if (typeof flags.aspect === 'string') body.aspect_ratio = flags.aspect;
  if (typeof flags.language === 'string') body.language = flags.language;
  if (typeof flags['idempotency-key'] === 'string') body.idempotency_key = flags['idempotency-key'];

  if (flags.estimate) {
    return outJson(await api('POST', '/videos/estimate', { tool, duration_seconds: body.duration_seconds, aspect_ratio: body.aspect_ratio }));
  }

  const created = await api<any>('POST', '/videos', body);
  if (!WANT_JSON) say(paint(`✓ Created ${created.video_id}${created.title ? `: ${created.title}` : ''} (${created.scene_count ?? '?'} scenes). Rendering…`, C.green));
  if (!flags.wait && !flags.out) return outJson(created);

  const v = await waitFor(created.video_id);
  if (v.status !== 'ready') {
    outJson(v);
    fail(`Video ${v.video_id} ${v.status}${v.error ? `: ${v.error}` : ''}.`, { video_id: v.video_id, status: v.status });
  }
  if (flags.out || flags.wait) {
    const file = await download(v.video_id, typeof flags.out === 'string' ? flags.out : undefined);
    if (WANT_JSON) return outJson({ ...v, file });
    say(paint(`✓ Saved ${file}`, C.green));
    return;
  }
  outJson(v);
}

// ─── help ────────────────────────────────────────────────
const HELP = `${paint('makeaivideo', C.bold)} — make short-form AI videos from your terminal.

${paint('Getting started', C.bold)}
  makeaivideo login                 Log in (opens your browser, saves a key locally)
  makeaivideo tools                 See the create tools and the fields each takes
  makeaivideo create explainer --topic "Why planes leave white trails" --wait --out trails.mp4

${paint('Videos', C.bold)}
  create <tool> --<field> ...    Create from a brief. --duration N --aspect 9:16|1:1|16:9 --language xx
                                 --idempotency-key k --wait --out file.mp4 --estimate (free quote) --draft
  create --script script.json    Create from your own script file (see \`script\`) + the same flags
  script --topic "..." | --tool explainer --field-topic "..."   Write a script only (prints JSON)
  scriptify <file.txt>           Structure your prose into a scene script
  fetch-url <url>                Fetch an article's text for the article tool
  videos                         List videos
  status <id>                    One video's status and progress
  wait <id> [--out file]         Block until ready/failed; download with --out
  download <id> [--out file]     Save the finished MP4
  update <id> [--title t] [--topic t] [--script f.json] [--caption-style s]
  generate <id>                  Start or re-run generation (drafts, after edits)
  export <id>                    Export again; \`renders <id>\` lists exports, \`render-progress <id>\`
  scene-regen <id> <n> [--narration "..."]      Regenerate one scene
  voice <id> --voice-id v [--stability balanced] Regenerate the voiceover
  captions <id> [--format srt|vtt] [--out f]     Caption file
  share <id> [--expires 86400]   Public expiring link
  cancel <id> | delete <id> | report <id> --reason "..." [--category other]

${paint('Ideas and helpers', C.bold)}
  ideas --niche "..." [--audience a] [--tone t] [--count n]
  enhance --topic "..."          Rewrite a rough topic into a stronger brief
  estimate <tool> [--duration N]

${paint('Characters, voices, music, brand', C.bold)}
  characters | character <id> | character-delete <id>
  portraits --prompt "..." --style s [--count 2]     Portrait candidates (credits)
  voice-previews [--sample "..."] [--gender male]     Candidate voices
  character-create --name n --style s --portrait <r2_key> --voice-preview <temp_key> --voice-id v
  upload <image...>              Upload reference images (multipart)
  upload-url <image_url>         Import a reference image from a URL
  voices [--gender f] | voice-preview <voiceId> [--text "..."]
  music | music-generate --prompt "..." [--duration 30] [--mood calm]
  brand-kit | brand-kit --show true|false | brand-kit-watermark <file.png>
  workspace | workspace --name n --aspect 9:16 --style cinematic

${paint('Webhooks', C.bold)}
  webhooks | webhook-add <url> --events video.ready,video.failed [--name n]
  webhook-test <id> | webhook-deliveries <id> | webhook-rm <id> | webhook-enable <id>

${paint('Account', C.bold)}
  whoami | credits | logout

${paint('Flags', C.bold)}
  --json     Machine-readable JSON (auto-on when piped). Errors go to stderr as JSON.

Auth precedence: MAKEAIVIDEO_API_KEY env var, else the key from \`login\`.
API spec: ${BASE}/api/v1/openapi.json`;

// ─── main ────────────────────────────────────────────────
async function main() {
  const [, , cmd, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);

  switch (cmd) {
    case undefined: case 'help': case '--help': case '-h': return say(HELP);
    case '--version': case '-v': case 'version': return say(VERSION);
    case 'login': return login();
    case 'logout': return logout();
    case 'whoami': return outJson(await api('GET', '/me'));
    case 'credits': return outJson(await api('GET', '/credits'));
    case 'tools': {
      const t = await api<any>('GET', '/tools');
      if (WANT_JSON) return outJson(t);
      for (const tool of t.tools) {
        say(`${paint(tool.id, C.bold)}  ${paint(tool.title, C.dim)}`);
        for (const f of tool.fields) say(`    --${f.name.replace(/_/g, '-')}${f.required ? '' : ' (optional)'}  ${f.label}`);
        say(`    durations: ${tool.defaults.durations.join(', ')}s  default aspect: ${tool.defaults.aspect_ratio}`);
      }
      return;
    }
    case 'create': return create(positional, flags);
    case 'estimate': {
      if (!positional[0]) fail('Usage: makeaivideo estimate <tool> [--duration N] [--aspect 9:16]');
      return outJson(await api('POST', '/videos/estimate', {
        tool: positional[0],
        duration_seconds: typeof flags.duration === 'string' ? Number(flags.duration) : undefined,
        aspect_ratio: typeof flags.aspect === 'string' ? flags.aspect : undefined,
      }));
    }
    case 'videos': return outJson(await api('GET', '/videos'));
    case 'status': {
      if (!positional[0]) fail('Usage: makeaivideo status <videoId>');
      return outJson(await api('GET', `/videos/${encodeURIComponent(positional[0])}`));
    }
    case 'wait': {
      if (!positional[0]) fail('Usage: makeaivideo wait <videoId> [--out file.mp4]');
      const v = await waitFor(positional[0]);
      if (v.status === 'ready' && typeof flags.out === 'string') {
        const file = await download(v.video_id, flags.out);
        return outJson({ ...v, file });
      }
      return outJson(v);
    }
    case 'download': {
      if (!positional[0]) fail('Usage: makeaivideo download <videoId> [--out file.mp4]');
      const file = await download(positional[0], typeof flags.out === 'string' ? flags.out : undefined);
      if (WANT_JSON) return outJson({ video_id: positional[0], file });
      return say(paint(`✓ Saved ${file}`, C.green));
    }
    case 'cancel': {
      if (!positional[0]) fail('Usage: makeaivideo cancel <videoId>');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/cancel`, {}));
    }
    case 'voices': {
      const qs = new URLSearchParams();
      for (const k of ['gender', 'accent', 'age', 'use_case']) if (typeof flags[k] === 'string') qs.set(k, String(flags[k]));
      return outJson(await api('GET', `/voices${qs.size ? `?${qs}` : ''}`));
    }
    case 'characters': return outJson(await api('GET', '/characters'));
    case 'templates': return outJson(await api('GET', '/templates'));
    case 'script': {
      const body: Record<string, unknown> = { topic: flags.topic, target_duration: typeof flags.duration === 'string' ? Number(flags.duration) : undefined, mode: flags.mode, language: flags.language };
      if (typeof flags.tool === 'string') {
        const fields: Record<string, string> = {};
        for (const [k, v] of Object.entries(flags)) if (k.startsWith('field-') && typeof v === 'string') fields[k.slice(6).replace(/-/g, '_')] = v;
        body.brief = { tool: flags.tool, fields };
        delete body.topic;
      }
      return outJson(await api('POST', '/videos/script', body));
    }
    case 'scriptify': {
      if (!positional[0]) fail('Usage: makeaivideo scriptify <file.txt> [--mode cinematic] [--duration N]');
      const text = fs.readFileSync(positional[0], 'utf8');
      return outJson(await api('POST', '/videos/scriptify', { text, mode: flags.mode, target_duration: typeof flags.duration === 'string' ? Number(flags.duration) : undefined }));
    }
    case 'fetch-url': {
      if (!positional[0]) fail('Usage: makeaivideo fetch-url <url>');
      return outJson(await api('POST', '/videos/fetch-url', { url: positional[0] }));
    }
    case 'update': {
      if (!positional[0]) fail('Usage: makeaivideo update <videoId> [--title t] [--topic t] [--script f.json] [--caption-style s] [--caption-alignment top|middle|bottom]');
      const body: Record<string, unknown> = { title: flags.title, topic: flags.topic, caption_style: flags['caption-style'], caption_alignment: flags['caption-alignment'] };
      if (typeof flags.script === 'string') body.script = readJsonFile(flags.script);
      return outJson(await api('PATCH', `/videos/${encodeURIComponent(positional[0])}`, body));
    }
    case 'generate': {
      if (!positional[0]) fail('Usage: makeaivideo generate <videoId>');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/generate`, {}));
    }
    case 'export': {
      if (!positional[0]) fail('Usage: makeaivideo export <videoId>');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/renders`, {}));
    }
    case 'renders': {
      if (!positional[0]) fail('Usage: makeaivideo renders <videoId>');
      return outJson(await api('GET', `/videos/${encodeURIComponent(positional[0])}/renders`));
    }
    case 'render-progress': {
      if (!positional[0]) fail('Usage: makeaivideo render-progress <videoId>');
      return outJson(await api('GET', `/videos/${encodeURIComponent(positional[0])}/renders/progress`));
    }
    case 'scene-regen': {
      if (!positional[0] || !positional[1]) fail('Usage: makeaivideo scene-regen <videoId> <sceneNumber> [--narration "..."]');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/scenes/${Number(positional[1])}/regenerate`, { narration: flags.narration }));
    }
    case 'voice': {
      if (!positional[0] || typeof flags['voice-id'] !== 'string') fail('Usage: makeaivideo voice <videoId> --voice-id <id> [--stability stable|balanced|expressive]');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/voice`, { voice_id: flags['voice-id'], voice_stability: flags.stability }));
    }
    case 'captions': {
      if (!positional[0]) fail('Usage: makeaivideo captions <videoId> [--format srt|vtt] [--out file]');
      const key = resolveKey(); const fmt = typeof flags.format === 'string' ? flags.format : 'srt';
      const resp = await fetch(`${BASE}/api/v1/videos/${encodeURIComponent(positional[0])}/captions?format=${fmt}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!resp.ok) { const j = (await resp.json().catch(() => ({}))) as Envelope<unknown>; const e = errOf(j, resp.status); fail(e?.message || `HTTP ${resp.status}`); }
      const text = await resp.text();
      if (typeof flags.out === 'string') { fs.writeFileSync(flags.out, text); return WANT_JSON ? outJson({ file: path.resolve(flags.out) }) : say(paint(`✓ Saved ${flags.out}`, C.green)); }
      return process.stdout.write(text);
    }
    case 'share': {
      if (!positional[0]) fail('Usage: makeaivideo share <videoId> [--expires seconds]');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/share-link`, { expires_in_seconds: typeof flags.expires === 'string' ? Number(flags.expires) : undefined }));
    }
    case 'delete': {
      if (!positional[0]) fail('Usage: makeaivideo delete <videoId>');
      return outJson(await api('DELETE', `/videos/${encodeURIComponent(positional[0])}`));
    }
    case 'report': {
      if (!positional[0] || typeof flags.reason !== 'string') fail('Usage: makeaivideo report <videoId> --reason "..." [--category nsfw|violence|trademark|harassment|other]');
      return outJson(await api('POST', `/videos/${encodeURIComponent(positional[0])}/report`, { reason: flags.reason, category: flags.category }));
    }
    case 'ideas': {
      if (typeof flags.niche !== 'string') fail('Usage: makeaivideo ideas --niche "..." [--audience a] [--tone t] [--count n]');
      return outJson(await api('POST', '/ideas', { niche: flags.niche, audience: flags.audience, tone: flags.tone, count: typeof flags.count === 'string' ? Number(flags.count) : undefined }));
    }
    case 'enhance': {
      if (typeof flags.topic !== 'string') fail('Usage: makeaivideo enhance --topic "..."');
      return outJson(await api('POST', '/ai/enhance-prompt', { topic: flags.topic, mode: flags.mode }));
    }
    case 'character': {
      if (!positional[0]) fail('Usage: makeaivideo character <id>');
      return outJson(await api('GET', `/characters/${Number(positional[0])}`));
    }
    case 'character-delete': {
      if (!positional[0]) fail('Usage: makeaivideo character-delete <id>');
      return outJson(await api('DELETE', `/characters/${Number(positional[0])}`));
    }
    case 'portraits': {
      if (typeof flags.prompt !== 'string' || typeof flags.style !== 'string') fail('Usage: makeaivideo portraits --prompt "..." --style <style> [--count 2]');
      return outJson(await api('POST', '/characters/variations', { prompt: flags.prompt, style: flags.style, count: typeof flags.count === 'string' ? Number(flags.count) : undefined }));
    }
    case 'voice-previews': return outJson(await api('POST', '/characters/voice-previews', { sample_text: flags.sample, gender_hint: flags.gender }));
    case 'character-create': {
      const need = ['name', 'style', 'portrait', 'voice-preview', 'voice-id'];
      for (const k of need) if (typeof flags[k] !== 'string') fail('Usage: makeaivideo character-create --name n --style s --portrait <r2_key> --voice-preview <temp_key> --voice-id v [--description d]');
      return outJson(await api('POST', '/characters', { name: flags.name, style: flags.style, description: flags.description, portrait_temp_key: flags.portrait, voice_preview_temp_key: flags['voice-preview'], voice_id: flags['voice-id'] }));
    }
    case 'upload': {
      if (!positional.length) fail('Usage: makeaivideo upload <image> [more images...]');
      return outJson(await upload('/uploads/reference', 'files', positional));
    }
    case 'upload-url': {
      if (!positional[0]) fail('Usage: makeaivideo upload-url <image_url>');
      return outJson(await api('POST', '/uploads/reference-from-url', { image_url: positional[0] }));
    }
    case 'voice-preview': {
      if (!positional[0]) fail('Usage: makeaivideo voice-preview <voiceId> [--text "..."]');
      if (typeof flags.text === 'string') return outJson(await api('POST', '/voices/preview', { voice_id: positional[0], text: flags.text }));
      return outJson(await api('GET', `/voices/${encodeURIComponent(positional[0])}/preview`));
    }
    case 'music': return outJson(await api('GET', '/music'));
    case 'music-generate': {
      if (typeof flags.prompt !== 'string') fail('Usage: makeaivideo music-generate --prompt "..." [--duration 15|30|60] [--mood calm]');
      return outJson(await api('POST', '/music', { prompt: flags.prompt, duration: typeof flags.duration === 'string' ? Number(flags.duration) : undefined, mood: flags.mood }));
    }
    case 'brand-kit': {
      if (typeof flags.show === 'string') return outJson(await api('PATCH', '/brand-kit', { show_watermark: flags.show === 'true' }));
      if (flags.remove) return outJson(await api('PATCH', '/brand-kit', { remove_watermark: true }));
      return outJson(await api('GET', '/brand-kit'));
    }
    case 'brand-kit-watermark': {
      if (!positional[0]) fail('Usage: makeaivideo brand-kit-watermark <file.png>');
      return outJson(await upload('/brand-kit/watermark', 'file', [positional[0]]));
    }
    case 'workspace': {
      const patch: Record<string, unknown> = { name: flags.name, description: flags.description, default_aspect_ratio: flags.aspect, default_style: flags.style };
      if (Object.values(patch).some((v) => v !== undefined)) return outJson(await api('PATCH', '/workspace', patch));
      return outJson(await api('GET', '/workspace'));
    }
    case 'webhooks': return outJson(await api('GET', '/webhooks'));
    case 'webhook-add': {
      if (!positional[0] || typeof flags.events !== 'string') fail('Usage: makeaivideo webhook-add <https-url> --events video.ready,video.failed [--name n]');
      const data = await api<any>('POST', '/webhooks', { url: positional[0], events: csv(flags.events), name: flags.name });
      if (!WANT_JSON) say(paint('Save the secret now, it is shown only once.', C.yellow));
      return outJson(data);
    }
    case 'webhook-test': {
      if (!positional[0]) fail('Usage: makeaivideo webhook-test <webhookId>');
      return outJson(await api('POST', `/webhooks/${encodeURIComponent(positional[0])}/test`, {}));
    }
    case 'webhook-deliveries': {
      if (!positional[0]) fail('Usage: makeaivideo webhook-deliveries <webhookId>');
      return outJson(await api('GET', `/webhooks/${encodeURIComponent(positional[0])}/deliveries`));
    }
    case 'webhook-rm': {
      if (!positional[0]) fail('Usage: makeaivideo webhook-rm <webhookId>');
      return outJson(await api('DELETE', `/webhooks/${encodeURIComponent(positional[0])}`));
    }
    case 'webhook-enable': {
      if (!positional[0]) fail('Usage: makeaivideo webhook-enable <webhookId>');
      return outJson(await api('PATCH', `/webhooks/${encodeURIComponent(positional[0])}`, { is_active: true }));
    }
    default:
      fail(`Unknown command "${cmd}". Run \`makeaivideo help\`.`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
