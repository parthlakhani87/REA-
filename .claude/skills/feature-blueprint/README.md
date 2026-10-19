# feature-blueprint skill

Take a feature you see elsewhere and build your own version of it, in any
domain: rights check → cheapest legitimate source → REA investigation →
behavior blueprint → clean-room build.

## Install

- **This repo:** already active (`.claude/skills/feature-blueprint`).
- **Any project:** copy this folder into that project's `.claude/skills/`.
- **All your Claude Code sessions:** copy it to `~/.claude/skills/feature-blueprint`.
- **claude.ai:** zip this folder and upload it under Settings → Capabilities → Skills.

REA itself is optional and installed separately; the skill's
`scripts/rea-check.sh` shows the setup plan before anything is changed.

## Use

Ask naturally, e.g. "I want the Export notes feature of this app in mine" or
"Let my app read DWG files and quote the marked ceiling areas". Output lands in
`docs/blueprints/<feature>/` in your project.

## Layout

```
SKILL.md                       the process (stages 0–6)
references/rights-check.md     how deep you may go, and when to stop
references/target-routing.md   which REA tool to start with per target
references/clean-room-build.md building and verifying your version
templates/feature-spec.md      blueprint template
templates/findings-ledger.md   evidence ledger template
scripts/rea-check.sh           read-only REA readiness check
```

Credits: investigation workflow adapted from REA
(https://github.com/morluto/rea, MIT License).
