# Changelog

All notable changes to `@makeaivideo/cli` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-04

### Added
- Full API coverage: scripts (`script`, `scriptify`, `fetch-url`), editing (`update`, `generate`,
  `scene-regen`, `voice`, `export`, `renders`, `render-progress`), `captions`, `share`, `delete`,
  `report`, `ideas`, `enhance`, characters (`character`, `portraits`, `voice-previews`,
  `character-create`, `character-delete`), uploads (`upload`, `upload-url`), `voice-preview`,
  `music`, `music-generate`, `brand-kit`, `brand-kit-watermark`, `workspace`, and webhooks
  (`webhooks`, `webhook-add`, `webhook-test`, `webhook-deliveries`, `webhook-enable`, `webhook-rm`).
- `create --script file.json` renders your own script; `--draft` saves without rendering.

## [0.1.0] - 2026-09-03

### Added
- Initial release: `login` (device flow), `tools`, `estimate`, `create --wait --out`, `videos`,
  `status`, `wait`, `download`, `cancel`, `voices`, `characters`, `templates`, `whoami`, `credits`.
