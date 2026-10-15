// The anchor declaration of kadmos `standards/code-anchors.md`:
//
//   <comment> <marker>[<slug>|<relation>|<reference>] [<message>]

import type { CodeAnchorContract, VaultContract } from './contract.ts';
import { type NoteReference, type ParseResult, parseReference } from './reference.ts';

export interface AnchorDeclaration {
	readonly slug: string;
	readonly relation: string;
	/** The reference as written. */
	readonly reference: string;
	readonly target: NoteReference;
	/** Free text after the closing bracket; not read by machines. */
	readonly message?: string;
}

// Only comment syntax may precede the marker: punctuation, not words.
const COMMENT_PREFIX = /^\s*(?:[^\p{L}\p{N}_\s]+\s*)?$/u;

/**
 * Parses one line. A line without the marker is not a declaration and yields
 * `undefined`; a line with the marker either parses or fails with a reason.
 */
export function parseAnchorLine(
	line: string,
	contract: VaultContract & { readonly codeAnchors: CodeAnchorContract },
): ParseResult<AnchorDeclaration> | undefined {
	const { marker, slugPattern, relations } = contract.codeAnchors;
	const at = line.indexOf(marker);
	if (at === -1) return undefined;

	if (!COMMENT_PREFIX.test(line.slice(0, at))) {
		return fail('only the comment syntax of the file precedes the marker');
	}
	const rest = line.slice(at + marker.length);
	const match = /^\[([^\]\s]*)\](.*)$/u.exec(rest);
	if (match === null) return fail(`the marker is followed by "[<slug>|<relation>|<reference>]" without whitespace`);
	const [, inner = '', tail = ''] = match;
	if (tail !== '' && !/^\s/u.test(tail))
		return fail('the message is separated from the closing bracket by whitespace');

	const fields = inner.split('|');
	if (fields.length !== 3) return fail('the brackets hold exactly three fields');
	const [slug = '', relation = '', reference = ''] = fields;
	if (!slugPattern.test(slug)) return fail(`"${slug}" does not match the declared slug pattern`);
	if (!relations.includes(relation)) return fail(`"${relation}" is not a declared relation`);

	const parsed = parseReference(reference, contract);
	if (!parsed.ok) return fail(`the reference is invalid: ${parsed.reason}`);
	if (parsed.value.kind !== 'note') return fail('the reference names a note or a heading, never an anchor');

	const message = tail.trim();
	return {
		ok: true,
		value: { slug, relation, reference, target: parsed.value, ...(message === '' ? {} : { message }) },
	};
}

function fail(reason: string): ParseResult<never> {
	return { ok: false, reason };
}
