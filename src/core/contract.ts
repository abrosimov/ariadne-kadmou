// The part of a vault's root schema that Ariadne reads. Kadmos declares these
// values as data in `config` of `.vault-schema.txtpb`; nothing here is a
// default, so a schema that omits them is reported, not patched over.

import {
	type TextprotoMessage,
	TextprotoError,
	messages,
	onlyMessage,
	onlyString,
	parseTextproto,
	strings,
} from './textproto.ts';

export const SCHEMA_FILE = '.vault-schema.txtpb';

export interface CodeAnchorContract {
	readonly marker: string;
	readonly slugPattern: RegExp;
	readonly relations: readonly string[];
	readonly reverseField: string;
}

export interface VaultContract {
	/** Directories that hold archived and buried notes, from `retention_projection`. */
	readonly retentionRoots: readonly string[];
	/** Root directories outside the note population, from `validation_scope`. */
	readonly excludedRootDirectories: readonly string[];
	/** File basenames outside the note population, from `validation_scope`. */
	readonly excludedFileNames: readonly string[];
	/** Undefined when the schema declares no `config.code_anchors`. */
	readonly codeAnchors?: CodeAnchorContract;
}

export class ContractError extends Error {}

export function parseContract(schemaSource: string): VaultContract {
	let schema: TextprotoMessage;
	try {
		schema = parseTextproto(schemaSource);
	} catch (error) {
		if (error instanceof TextprotoError) throw new ContractError(`${SCHEMA_FILE}: ${error.message}`);
		throw error;
	}
	try {
		return readContract(schema);
	} catch (error) {
		if (error instanceof TextprotoError) throw new ContractError(`${SCHEMA_FILE}: ${error.message}`);
		throw error;
	}
}

function readContract(schema: TextprotoMessage): VaultContract {
	const config = onlyMessage(schema, 'config');
	if (!config) throw new ContractError(`${SCHEMA_FILE} declares no config`);

	const retentionRoots = messages(config, 'retention_projection').flatMap((projection) =>
		strings(projection, 'root_directory'),
	);
	if (retentionRoots.length === 0) {
		throw new ContractError(`${SCHEMA_FILE} declares no retention_projection root_directory`);
	}

	const scope = onlyMessage(config, 'validation_scope');
	const excludedRootDirectories = scope ? strings(scope, 'excluded_root_directory') : [];
	const excludedFileNames = scope ? strings(scope, 'excluded_file_name') : [];

	const anchors = onlyMessage(config, 'code_anchors');
	return {
		retentionRoots,
		excludedRootDirectories,
		excludedFileNames,
		...(anchors ? { codeAnchors: readCodeAnchors(anchors) } : {}),
	};
}

function readCodeAnchors(anchors: TextprotoMessage): CodeAnchorContract {
	const marker = required(anchors, 'marker');
	const pattern = required(anchors, 'slug_pattern');
	let slugPattern: RegExp;
	try {
		slugPattern = new RegExp(pattern, 'u');
	} catch {
		throw new ContractError(`${SCHEMA_FILE}: code_anchors.slug_pattern is not a valid pattern`);
	}
	const relations = strings(anchors, 'relation');
	if (relations.length === 0) throw new ContractError(`${SCHEMA_FILE} declares no code_anchors.relation`);

	return { marker, slugPattern, relations, reverseField: required(anchors, 'reverse_field') };
}

function required(message: TextprotoMessage, name: string): string {
	const value = onlyString(message, name);
	if (!value) throw new ContractError(`${SCHEMA_FILE} declares no code_anchors.${name}`);
	return value;
}
