// A reader for the subset of the protobuf text format that kadmos writes:
// nested messages, scalar fields, `#` comments. Every field is repeated, so a
// message maps each name to the values in the order they were written.

export type TextprotoValue = string | number | boolean | TextprotoMessage;

export interface TextprotoMessage {
	readonly fields: ReadonlyMap<string, readonly TextprotoValue[]>;
}

export class TextprotoError extends Error {}

type Token =
	| { kind: 'ident'; text: string; line: number }
	| { kind: 'string'; text: string; line: number }
	| { kind: 'number'; text: string; line: number }
	| { kind: 'punct'; text: string; line: number };

export function parseTextproto(source: string): TextprotoMessage {
	const tokens = tokenize(source);
	let pos = 0;

	const peek = (): Token | undefined => tokens[pos];
	const next = (): Token => {
		const token = tokens[pos++];
		if (!token) throw new TextprotoError('unexpected end of input');
		return token;
	};

	const parseMessage = (closing: string | null): TextprotoMessage => {
		const fields = new Map<string, TextprotoValue[]>();
		for (;;) {
			const token = peek();
			if (!token) {
				if (closing) throw new TextprotoError(`missing "${closing}"`);
				return { fields };
			}
			if (token.kind === 'punct' && token.text === closing) {
				pos++;
				return { fields };
			}
			const name = next();
			if (name.kind !== 'ident') {
				throw new TextprotoError(`line ${name.line}: expected a field name`);
			}
			let separator = peek();
			if (separator?.kind === 'punct' && separator.text === ':') {
				pos++;
				separator = peek();
			}
			let value: TextprotoValue;
			if (separator?.kind === 'punct' && (separator.text === '{' || separator.text === '<')) {
				pos++;
				value = parseMessage(separator.text === '{' ? '}' : '>');
			} else {
				value = parseScalar(next());
			}
			const values = fields.get(name.text);
			if (values) values.push(value);
			else fields.set(name.text, [value]);
			const after = peek();
			if (after?.kind === 'punct' && (after.text === ';' || after.text === ',')) pos++;
		}
	};

	return parseMessage(null);
}

function parseScalar(token: Token): string | number | boolean {
	switch (token.kind) {
		case 'string':
			return token.text;
		case 'number':
			return Number(token.text);
		case 'ident':
			if (token.text === 'true') return true;
			if (token.text === 'false') return false;
			return token.text;
		default:
			throw new TextprotoError(`line ${token.line}: expected a value, found "${token.text}"`);
	}
}

const ESCAPES: Record<string, string> = {
	n: '\n',
	t: '\t',
	r: '\r',
	'\\': '\\',
	'"': '"',
	"'": "'",
};

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let line = 1;
	let i = 0;
	while (i < source.length) {
		const ch = source.charAt(i);
		if (ch === '\n') {
			line++;
			i++;
		} else if (/\s/.test(ch)) {
			i++;
		} else if (ch === '#') {
			while (i < source.length && source.charAt(i) !== '\n') i++;
		} else if (ch === '"' || ch === "'") {
			let text = '';
			i++;
			for (;;) {
				const c = source.charAt(i);
				if (i >= source.length || c === '\n') {
					throw new TextprotoError(`line ${line}: unterminated string`);
				}
				i++;
				if (c === ch) break;
				if (c === '\\') {
					const escaped = ESCAPES[source.charAt(i)];
					if (escaped === undefined) {
						throw new TextprotoError(`line ${line}: unsupported escape "\\${source.charAt(i)}"`);
					}
					text += escaped;
					i++;
				} else {
					text += c;
				}
			}
			// Adjacent string literals concatenate.
			const last = tokens[tokens.length - 1];
			if (last?.kind === 'string') last.text += text;
			else tokens.push({ kind: 'string', text, line });
		} else if (/[A-Za-z_]/.test(ch)) {
			const match = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(source.slice(i));
			const text = match ? match[0] : ch;
			tokens.push({ kind: 'ident', text, line });
			i += text.length;
		} else if (/[-0-9.]/.test(ch)) {
			const match = /^-?[0-9.][0-9.eE+-]*/.exec(source.slice(i));
			const text = match ? match[0] : ch;
			if (Number.isNaN(Number(text))) throw new TextprotoError(`line ${line}: bad number "${text}"`);
			tokens.push({ kind: 'number', text, line });
			i += text.length;
		} else if ('{}<>:;,'.includes(ch)) {
			tokens.push({ kind: 'punct', text: ch, line });
			i++;
		} else {
			throw new TextprotoError(`line ${line}: unexpected "${ch}"`);
		}
	}
	return tokens;
}

export function strings(message: TextprotoMessage, name: string): string[] {
	return (message.fields.get(name) ?? []).map((value) => {
		if (typeof value !== 'string') throw new TextprotoError(`field "${name}" is not a string`);
		return value;
	});
}

export function messages(message: TextprotoMessage, name: string): TextprotoMessage[] {
	return (message.fields.get(name) ?? []).map((value) => {
		if (typeof value !== 'object') throw new TextprotoError(`field "${name}" is not a message`);
		return value;
	});
}

export function onlyString(message: TextprotoMessage, name: string): string | undefined {
	const values = strings(message, name);
	if (values.length > 1) throw new TextprotoError(`field "${name}" is set more than once`);
	return values[0];
}

export function onlyMessage(message: TextprotoMessage, name: string): TextprotoMessage | undefined {
	const values = messages(message, name);
	if (values.length > 1) throw new TextprotoError(`field "${name}" is set more than once`);
	return values[0];
}
