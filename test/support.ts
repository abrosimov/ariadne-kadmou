import { readFileSync } from 'node:fs';
import { type VaultContract, parseContract } from '../src/core/contract.ts';
import { type TextprotoMessage, parseTextproto } from '../src/core/textproto.ts';

export function vector(name: string): string {
	return readFileSync(new URL(`vectors/${name}`, import.meta.url), 'utf8');
}

export function vectors(name: string): TextprotoMessage {
	return parseTextproto(vector(name));
}

export function sourceContract(): VaultContract & { codeAnchors: NonNullable<VaultContract['codeAnchors']> } {
	const contract = parseContract(vector('source_vault_schema.txtpb'));
	if (contract.codeAnchors === undefined) throw new Error('the source vault schema declares code_anchors');
	return { ...contract, codeAnchors: contract.codeAnchors };
}
