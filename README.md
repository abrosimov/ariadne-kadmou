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
- **Code anchors.** On the desktop, Ariadne scans the folder Obsidian opened for
  `ariadne-kadmou[<slug>|<relation>|<reference>]` declarations outside the kadmos vault.
  Open Obsidian at the repository root, whose `.vault-root` names the vault: opened at the
  vault itself, anchors are reported as not checked. The walk honours `.gitignore` files and skips the
  vault, dot-entries, `node_modules`, symbolic links, binaries and files over 1 MiB.
  `kadmos://oikos/#<slug>` resolves to the one declaration of that slug and opens its file
  with the application the operating system assigns to it, but only for sources and data on
  an allowlist (`src/core/openable.ts`); scripts and anything else that a default
  application would run are not opened. **Show code anchors of this
  note** lists the anchors naming the note and what is wrong with its `anchored_by`. The
  scan reruns when Obsidian regains focus, reading only files that changed, and on
  **Rescan code anchors**; malformed declarations are listed on the status bar item.

The scan approximates what Git would list without running Git. It does not see files
force-added past a `.gitignore`, does not read `.git/info/exclude` or a global excludes
file, and applies an outer `.gitignore` inside submodules. Each rescan lists the tree
again; only file contents are cached. Lynkeus, the validator, remains the authority on
which declarations exist.

Ariadne reads only inside the folder Obsidian opened, writes nothing, sends nothing
anywhere and makes no network request.

## Installation

Ariadne is not in the community plugin catalogue yet. It needs Obsidian 1.8.7 or later on
the desktop.

**With BRAT.** [BRAT](https://github.com/TfTHacker/obsidian42-brat) installs plugins from
the GitHub releases of a repository and keeps them updated.

1. In **Settings → Community plugins**, install and enable **BRAT**.
2. Run **BRAT: Add a beta plugin for testing**, enter `abrosimov/ariadne-kadmou`, choose a
   version, and enable **Ariadne kadmou** in **Settings → Community plugins**.

**By hand.** Copy `main.js`, `manifest.json` and `styles.css` from a release, or from
`task build`, into `<vault>/.obsidian/plugins/ariadne-kadmou/`, then enable the plugin
in **Settings → Community plugins**.

## Still to come

- Direct dependencies, once Pinax fixes its manifest and dependency root.
- Lynkeus findings on the notes they concern, once Lynkeus fixes its output.

The contract Ariadne follows is fixed in kadmos: `standards/cross-instance-references.md`,
`standards/code-anchors.md` and decisions D-036 to D-039.

## Development

The toolchain is hermetic, after go-core: everything path-valued lives under `.hermetic/`,
which Git ignores.

- `pins.env` pins Node and Task with the SHA256 of each published archive.
- `packageManager` in `package.json` pins pnpm with its digest, which Corepack enforces.
- `bin/bootstrap.sh` needs only bash, curl, tar and sha256sum or shasum. It installs Node
  and Task below `.hermetic/stacks/node/` and runs `task install`, which brings pnpm and
  the locked dependencies.
- pnpm keeps its store and the package files below `.hermetic/` too; `node_modules/`
  holds only links.
- `Taskfile.yml` points Corepack, the npm and XDG caches and the Obsidian downloads there
  as well. The committed `.taskrc.yml` makes those settings win over the caller's shell.
- `pnpm-workspace.yaml` names the only dependencies whose install scripts may run.
- Renovate follows the shared `abrosimov/renovate-config` preset. `renovate.json5` teaches
  it the pins in `pins.env` and the pinned config validator. Renovate moves a version;
  `task pins`, which CI runs, then names each digest that no longer matches what the
  publisher states, for filling by hand.

```bash
./bin/bootstrap.sh                       # once per clone, and after a pin moves
T=.hermetic/stacks/node/bin/task
$T --list                                # every command, from Taskfile.yml
$T dev                                   # watch build of src/main.ts into main.js
$T check                                 # format, lint, unit tests with the coverage gate, typecheck, build
$T e2e                                   # builds, then runs test/e2e/ in real Obsidian
```

End-to-end tests run through WebdriverIO and `wdio-obsidian-service`, which downloads
Obsidian into `.hermetic/stacks/node/obsidian-cache/` and opens each vault under `test/e2e/vaults/` in a sandbox.
On Linux without a display, WebdriverIO starts a virtual display per worker; do not wrap
the run in `xvfb-run`, or parallel Obsidian windows share one display and take focus
from each other. They run on the plugin's `minAppVersion` with its oldest installer and on the latest
release. `minAppVersion` equals the version of the `obsidian` API package the plugin
compiles against, so no newer API can slip in unnoticed.

CI bootstraps the same way and runs `task check` and `task e2e`; any finding fails it.
Lint is typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, unicorn, the
Obsidian rules and a set of stricter rules on top, with no rule about comments or layout:
layout belongs to Prettier. Every dev dependency is pinned to an exact version.

`src/core/` is free of Obsidian: the `kadmos://` grammar, the anchor declaration, the
resolver, the vault markers and the reader of the root schema. The vectors under
`test/vectors/` are copied from kadmos at the commit their header names; refresh them by
copying again, never by editing a vector.

## Releasing

`task version -- x.y.z` sets the version in `package.json` and `manifest.json`
and records the minimum Obsidian version in `versions.json`. Commit it, and push a tag
named exactly `x.y.z`, without a `v`: the release workflow checks that the tag matches
the manifest, runs `task check`, and publishes a release with `main.js`, `manifest.json`
and `styles.css`, which BRAT then offers.
