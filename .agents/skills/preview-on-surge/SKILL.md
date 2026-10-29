---
name: preview-on-surge
description: Put a rig page on a public surge.sh link for review, then take the lane marker off it afterwards (ADR 0003). Use for a plan's "Preview for review" and "Clean up" issues when the host is surge.sh.
---

# preview-on-surge

A preview is one HTML file on a public HTTPS link that we can upload over later (ADR 0003).
This is the surge.sh route. Any other host: same steps, its own CLI.

## Before anything

- Ask the human before every upload and before every discard: what, why, where, who can see it,
  how to undo. Anyone with the link can open it.
- The human signs in, never the agent: `npx surge login`. Check with `npx surge whoami`.
- Keep the domain the same for the whole plan, e.g. `<repo>-<owner>.surge.sh`.
- Previews live in `var/` (git-ignored). Never in the repo, an issue or a chat attachment.

## 1. Save the page (with the marker)

Run rig with `.env` and save the page with a command, not a browser's "save as":

```sh
PORT=8799 pnpm start &
mkdir -p var/preview
curl -sf localhost:8799/digest/<night> -o var/preview/index.html
```

Check the file: the banner shows the marker, no `<script`, only sample data from `runs/`.

## 2. Upload and check the link

```sh
npx surge var/preview <domain>
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/
```

200, and the fetched page matches `var/preview/index.html`. Only then send the link.

## 3. Wait for the review

Sending the link isn't the review. The preview issue stays open until the reviewer says they
have looked; then close it. Don't take the marker off before that.

## 4. Take the marker off

Save the page again with `LANE_MARKER` unset (banner reads "no marker set") and upload it over
the same domain:

```sh
env -u LANE_MARKER PORT=8798 npx tsx src/server.ts &
mkdir -p var/preview-clean
curl -sf localhost:8798/digest/<night> -o var/preview-clean/index.html
npx surge var/preview-clean <domain>
```

## 5. Remove old revisions

surge keeps every upload at its own public address (`<rev>--<domain>`), so the upload over the
link cleans only the main address. List them and discard every revision that still has the
marker. A discard is permanent: the human runs it, or says yes to it.

```sh
npx surge <domain> revs
npx surge <domain> discard <rev>--<domain>
```

Then fetch every address (`https://<domain>/`, `https://latest--<domain>/`, each remaining rev)
and grep for the marker. Done when none shows it.

Undo for the whole preview: `npx surge <domain> teardown` (removes the project).
