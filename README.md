# Ariadne kadmou

Ἀριάδνη Κάδμου: the Obsidian companion of [kadmos](https://github.com/abrosimov/kadmos),
the template for project documentation and its machinery. Ariadne follows the thread
between kadmos vaults: it resolves `kadmos://` references into other instances and into
the vault's own notes, follows code anchors declared as
`ariadne-kadmou[<slug>|<relation>|<reference>]` in source and model files, and shows the
findings of Lynkeus, the kadmos validator, on the notes they concern.

Status: pre-alpha. The vault is found only where the markers put it: a `.vault-profile`
at the root of the opened folder makes that folder the vault, a `.vault-root` there names
the child that is. Without either Ariadne stays idle.

## What it does

- **References.** Every Markdown link to `kadmos://oikos/...` is marked, in reading view
  and in the editor, with its resolution: resolved, stale, renamed, missing, invalid, or
  naming a vault that is not a direct dependency. A click follows it (a modified click in
  the source editor), the page preview shows its target, and typing after `kadmos://`
  completes the authority, an active note path, a heading or an anchor slug.
- **Code anchors.** On the desktop, Ariadne scans the repository of the vault for
  `ariadne-kadmou[<slug>|<relation>|<reference>]` declarations: the opened folder, or its
  parent when the parent's `.vault-root` names it. The walk honours `.gitignore` files and
  skips the vault itself, dot-entries, `node_modules`, symbolic links, binaries and files
  over 1 MiB; a vault that is its own repository has nothing outside it to scan.
  `kadmos://oikos/#<slug>` resolves to the one declaration of that slug and opens the code
  at the address set in the settings (`{url}` by default; `vscode://file/{path}:{line}`
  opens VS Code at the line). **Show code anchors of this note** lists the anchors naming
  the note and what is wrong with its `anchored_by`. The scan reruns when Obsidian regains
  focus, reading only files that changed, and on **Rescan code anchors**; malformed
  declarations are listed on the status bar item.

## File access

To find code anchors Ariadne reads files outside the Obsidian vault: the repository the
markers name, which is the parent folder when Obsidian is opened at the vault inside it.
It only reads, never writes, sends nothing anywhere and makes no network request. Without
`config.code_anchors` in the vault's schema it reads nothing outside the vault.

## Still to come

- Direct dependencies, once Pinax fixes its manifest and dependency root.
- Lynkeus findings on the notes they concern, once Lynkeus fixes its output.

The contract Ariadne follows is fixed in kadmos: `standards/cross-instance-references.md`,
`standards/code-anchors.md` and decisions D-036 to D-039.

## Development

Node.js 22.18 or later, for the type stripping the tests run on; npm, esbuild.

```bash
npm install
npm run dev      # watch build of src/main.ts into main.js
npm run build    # production build
npm run format   # Prettier
npm run typecheck
npm run lint     # fails on any warning
npm test         # node:test over test/ with the kadmos conformance vectors; src/core/ must stay fully covered
npm run e2e      # builds, then runs test/e2e/ in real Obsidian
```

End-to-end tests run through WebdriverIO and `wdio-obsidian-service`, which downloads
Obsidian into `.obsidian-cache/` and opens each vault under `test/e2e/vaults/` in a sandbox.
On Linux without a display, WebdriverIO starts a virtual display per worker; do not wrap
the run in `xvfb-run`, or parallel Obsidian windows share one display and take focus
from each other. They run on the plugin's `minAppVersion` with its oldest installer and on the latest
release. `minAppVersion` equals the version of the `obsidian` API package the plugin
compiles against, so no newer API can slip in unnoticed.

CI runs `format:check`, `typecheck`, `lint`, `test` and `build`; any finding fails it.
Lint is typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, unicorn, the
Obsidian rules and a set of stricter rules on top, with no rule about comments or layout:
layout belongs to Prettier. Every dev dependency is pinned to an exact version.

`src/core/` is free of Obsidian: the `kadmos://` grammar, the anchor declaration, the
resolver, the vault markers and the reader of the root schema. The vectors under
`test/vectors/` are copied from kadmos at the commit their header names; refresh them by
copying again, never by editing a vector.

To try a build, copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/ariadne-kadmou/` and enable the plugin.

## Releasing

Bump `manifest.json` and `versions.json` as the Obsidian plugin guidelines describe,
tag the exact version without a `v` prefix, and attach `main.js`, `manifest.json` and
`styles.css` to the GitHub release.
