# Ariadne kadmou

Ἀριάδνη Κάδμου: the Obsidian companion of [kadmos](https://github.com/abrosimov/kadmos),
the template for project documentation and its machinery. Ariadne follows the thread
between kadmos vaults: it resolves `kadmos://` references into other instances and into
the vault's own notes, follows code anchors declared as
`ariadne-kadmou[<slug>|<relation>|<reference>]` in source and model files, and shows the
findings of Lynkeus, the kadmos validator, on the notes they concern.

Status: pre-alpha. The repository was started from the Obsidian sample plugin and holds
no feature yet. The specification will live in `docs/` as a kadmos vault with a
dependency on `kadmos`, so that the plugin's own documentation is the first consumer of
the mechanisms it navigates.

## What it will do

- Resolve `kadmos://<authority>/<path>[#heading]` and `kadmos://<authority>/#<slug>`:
  `oikos` for the vault itself, a canonical name for a direct dependency, looked up in the
  dependency trees Pinax materialises. Hover preview, click to open, completion after
  `kadmos://`.
- Show anchors: which files tie themselves to a note, and the reverse, read from the
  validator's scan of the repository.
- Decorate notes with Lynkeus findings for stale, renamed and missing references and for
  drift after a dependency update.

The contract Ariadne follows is fixed in kadmos: `standards/cross-instance-references.md`,
`standards/code-anchors.md` and decisions D-036 to D-039.

## Development

Node.js 18 or later, npm, esbuild, as the sample plugin prescribes.

```bash
npm install
npm run dev      # watch build of src/main.ts into main.js
npm run build    # production build
npm run lint
```

To try a build, copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/ariadne-kadmou/` and enable the plugin.

## Releasing

Bump `manifest.json` and `versions.json` as the Obsidian plugin guidelines describe,
tag the exact version without a `v` prefix, and attach `main.js`, `manifest.json` and
`styles.css` to the GitHub release.
