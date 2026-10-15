# Ariadne kadmou

Ἀριάδνη Κάδμου: the Obsidian companion of [kadmos](https://github.com/abrosimov/kadmos),
the template for project documentation and its machinery. Ariadne follows the thread
between kadmos vaults: it resolves `kadmos://` references into other instances and into
the vault's own notes, follows code anchors declared as
`ariadne-kadmou[<slug>|<relation>|<reference>]` in source and model files, and shows the
findings of Lynkeus, the kadmos validator, on the notes they concern.

Status: pre-alpha. The plugin locates the kadmos vault by its markers and reads its
contract from the root schema; the parsers and the resolver below it reproduce the kadmos
conformance vectors, and nothing is shown in notes yet. The specification will live in this
repository as a kadmos vault, in the child its root `.vault-root` names, with a dependency
on `kadmos`, so that the plugin's own documentation is the first consumer of the
mechanisms it navigates.

Ariadne finds the kadmos vault only where the markers put it: a `.vault-profile` at the
root of the opened folder makes that folder the vault, a `.vault-root` there names the
child that is. Without either it stays idle.

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

Node.js 22.18 or later, for the type stripping the tests run on; npm, esbuild.

```bash
npm install
npm run dev      # watch build of src/main.ts into main.js
npm run build    # production build
npm run lint
npm test         # node:test over test/, including the kadmos conformance vectors
```

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
