import type { DMMF } from '@prisma/generator-helper';
import { Schema } from 'effect';
import { parseCustomTypeAnnotations } from '../utils/annotations.js';
import { toPascalCase } from '../utils/naming.js';

const OptionalString = Schema.optionalKey(Schema.String);
const OptionalBoolean = Schema.optionalKey(Schema.Boolean);
const TypeParams = Schema.Struct({ typeName: OptionalString });
const ValueSet = Schema.Struct({
  entityKind: OptionalString,
  entityName: Schema.String,
  namespaceId: OptionalString,
  plane: OptionalString,
});
const FieldType = Schema.Struct({
  codecId: Schema.String,
  kind: Schema.String,
  typeParams: Schema.optionalKey(TypeParams),
});
const ContractField = Schema.Struct({
  nullable: Schema.Boolean,
  many: OptionalBoolean,
  type: FieldType,
  valueSet: Schema.optionalKey(ValueSet),
});
const StorageField = Schema.Struct({ column: Schema.String });
const Relation = Schema.Struct({
  cardinality: Schema.String,
  on: Schema.Struct({
    localFields: Schema.Array(Schema.String),
    targetFields: Schema.Array(Schema.String),
  }),
  to: Schema.Struct({ model: Schema.String, namespace: Schema.String }),
});
const ContractModel = Schema.Struct({
  fields: Schema.Record(Schema.String, ContractField),
  relations: Schema.optionalKey(Schema.Record(Schema.String, Relation)),
  storage: Schema.Struct({
    fields: Schema.Record(Schema.String, StorageField),
    namespaceId: Schema.String,
    table: Schema.String,
  }),
});
const PrimaryKey = Schema.Struct({
  columns: Schema.Array(Schema.String),
  name: OptionalString,
});
const ColumnDefault = Schema.Struct({
  kind: Schema.String,
  expression: OptionalString,
  value: Schema.optionalKey(Schema.Unknown),
});
const ContractColumn = Schema.Struct({
  codecId: Schema.String,
  default: Schema.optionalKey(ColumnDefault),
  many: OptionalBoolean,
  nativeType: OptionalString,
  nullable: Schema.Boolean,
  typeParams: Schema.optionalKey(TypeParams),
  valueSet: Schema.optionalKey(ValueSet),
});
const ContractTable = Schema.Struct({
  columns: Schema.Record(Schema.String, ContractColumn),
  primaryKey: Schema.optionalKey(PrimaryKey),
});
const NativeEnum = Schema.Struct({
  members: Schema.Array(Schema.String),
  typeName: OptionalString,
});
const StorageValueSet = Schema.Struct({
  kind: Schema.String,
  values: Schema.Array(Schema.Unknown),
});
const DomainEnum = Schema.Struct({
  codecId: Schema.String,
  members: Schema.Array(Schema.Struct({ name: Schema.String, value: Schema.Unknown })),
});
const StorageNamespace = Schema.Struct({
  entries: Schema.Struct({
    native_enum: Schema.optionalKey(Schema.Record(Schema.String, NativeEnum)),
    table: Schema.Record(Schema.String, ContractTable),
    valueSet: Schema.optionalKey(Schema.Record(Schema.String, StorageValueSet)),
  }),
});
const DomainNamespace = Schema.Struct({
  enum: Schema.optionalKey(Schema.Record(Schema.String, DomainEnum)),
  models: Schema.Record(Schema.String, ContractModel),
});
const Contract = Schema.Struct({
  schemaVersion: Schema.String,
  targetFamily: Schema.String,
  target: Schema.String,
  domain: Schema.Struct({ namespaces: Schema.Record(Schema.String, DomainNamespace) }),
  storage: Schema.Struct({ namespaces: Schema.Record(Schema.String, StorageNamespace) }),
});

type Contract = typeof Contract.Type;
type ContractColumn = typeof ContractColumn.Type;
type ContractField = typeof ContractField.Type;
type ContractModel = typeof ContractModel.Type;
type Relation = typeof Relation.Type;
type StorageNamespace = typeof StorageNamespace.Type;

interface ModelDraft {
  readonly namespace: string;
  readonly source: ContractModel;
  readonly name: string;
  readonly dbName: string;
  readonly fields: DMMF.Field[];
  readonly primaryKey: DMMF.PrimaryKey | null;
}

interface EnumReference {
  readonly identity: string;
  readonly kind: 'domain' | 'storage';
  readonly name: string;
  readonly namespace: string;
  readonly storageName?: string;
}

const EMPTY_SCHEMA: DMMF.Schema = {
  inputObjectTypes: { model: [], prisma: [] },
  outputObjectTypes: { model: [], prisma: [] },
  enumTypes: { model: [], prisma: [] },
  fieldRefTypes: { prisma: [] },
};

const EMPTY_MAPPINGS: DMMF.Mappings = {
  modelOperations: [],
  otherOperations: { read: [], write: [] },
};

/**
 * Adapt Prisma 8's PostgreSQL contract artifact to the DMMF subset consumed by
 * the existing emitters. The adapter is deliberately strict: unsupported
 * codecs fail generation instead of silently widening to Schema.Unknown.
 */
export function contractToDmmf(contractJson: string, schemaSource = ''): DMMF.Document {
  const contract = Schema.decodeUnknownSync(Contract)(JSON.parse(contractJson));
  if (contract.schemaVersion !== '1') {
    throw new Error(`Unsupported Prisma contract schemaVersion ${contract.schemaVersion}`);
  }
  if (contract.targetFamily !== 'sql') {
    throw new Error(`Unsupported Prisma contract targetFamily ${contract.targetFamily}`);
  }
  if (contract.target !== 'postgres') {
    throw new Error(`Unsupported Prisma contract target ${contract.target}`);
  }

  const annotations = new Map(
    Array.from(parseCustomTypeAnnotations(schemaSource), ([key, value]) => [
      key,
      `@customType(${value})`,
    ])
  );
  const sources = Object.entries(contract.domain.namespaces).flatMap(([namespace, domain]) =>
    Object.entries(domain.models).map(([name, model]) => ({ namespace, model, name }))
  );
  const modelNames = assignNames(
    sources.map((source) => ({
      base: source.name,
      key: `${source.namespace}.${source.name}`,
      qualifier: source.namespace,
    }))
  );
  const enumReferences = new Map<string, EnumReference>();
  for (const [namespace, domain] of Object.entries(contract.domain.namespaces)) {
    for (const name of Object.keys(domain.enum ?? {})) {
      enumReferences.set(`domain:${namespace}.${name}`, {
        identity: `domain:${namespace}.${name}`,
        kind: 'domain',
        name,
        namespace,
      });
    }
  }

  for (const source of sources) {
    const storageNamespace = contract.storage.namespaces[source.model.storage.namespaceId];
    const table = storageNamespace?.entries.table[source.model.storage.table];
    if (!storageNamespace || !table) {
      throw new Error(`Missing storage table for ${source.namespace}.${source.name}`);
    }
    for (const [fieldName, field] of Object.entries(source.model.fields)) {
      const storageField = source.model.storage.fields[fieldName];
      const column = storageField && table.columns[storageField.column];
      if (!column) {
        throw new Error(
          `Missing storage column ${source.model.storage.table}.${storageField?.column}`
        );
      }
      const reference = enumReferenceFor(
        field,
        column,
        source.namespace,
        source.model.storage.namespaceId
      );
      if (reference) enumReferences.set(reference.identity, reference);
    }
  }

  const enumNames = assignNames(
    Array.from(enumReferences.values(), (reference) => ({
      base: reference.name,
      key: reference.identity,
      qualifier: reference.namespace,
    }))
  );
  const enumDefinitions = new Map<string, DMMF.DatamodelEnum>();
  const drafts: ModelDraft[] = [];
  const tableIdentities = new Set<string>();

  for (const source of sources) {
    const { model, namespace, name } = source;
    const tableIdentity = `${model.storage.namespaceId}.${model.storage.table}`;
    if (tableIdentities.has(tableIdentity)) {
      throw new Error(`Duplicate storage table in Prisma contract: ${tableIdentity}`);
    }
    tableIdentities.add(tableIdentity);

    const storageNamespace = contract.storage.namespaces[model.storage.namespaceId];
    const table = storageNamespace?.entries.table[model.storage.table];
    if (!storageNamespace || !table) {
      throw new Error(`Missing storage table for ${namespace}.${name}`);
    }

    const primaryKeyColumns = table.primaryKey?.columns ?? [];
    const primaryKeyFields = primaryKeyColumns.map((column) =>
      logicalFieldForColumn(model, column, `${namespace}.${name}`)
    );
    const fields = Object.entries(model.fields).map(([fieldName, field]) => {
      const storageField = model.storage.fields[fieldName];
      if (!storageField) {
        throw new Error(`Missing storage field for ${namespace}.${name}.${fieldName}`);
      }
      const column = table.columns[storageField.column];
      if (!column) {
        throw new Error(`Missing storage column ${model.storage.table}.${storageField.column}`);
      }
      if (field.type.kind !== 'scalar') {
        throw new Error(
          `Unsupported Prisma contract field kind ${field.type.kind} at ${namespace}.${name}.${fieldName}`
        );
      }
      const reference = enumReferenceFor(field, column, namespace, model.storage.namespaceId);
      const scalar = fieldToDmmfType(field, reference, enumNames);
      if (reference) {
        addEnumDefinition(enumDefinitions, enumNames.get(reference.identity)!, reference, contract);
      }

      const documentation = annotations.get(`${namespace}.${name}.${fieldName}`);
      return {
        kind: scalar.kind,
        name: fieldName,
        isRequired: !field.nullable,
        isList: field.many === true || column.many === true,
        isUnique: false,
        isId: primaryKeyFields.length === 1 && primaryKeyFields[0] === fieldName,
        isReadOnly: false,
        isUpdatedAt: false,
        type: scalar.type,
        nativeType: scalar.nativeType,
        dbName: storageField.column === fieldName ? null : storageField.column,
        hasDefaultValue: column.default !== undefined,
        ...(column.default === undefined ? {} : { default: { name: 'dbgenerated', args: [] } }),
        ...(documentation === undefined ? {} : { documentation }),
      } satisfies DMMF.Field;
    });

    drafts.push({
      namespace,
      source: model,
      name: modelNames.get(`${namespace}.${name}`)!,
      dbName: model.storage.table,
      fields,
      primaryKey:
        primaryKeyFields.length === 0
          ? null
          : { name: table.primaryKey?.name ?? null, fields: primaryKeyFields },
    });
  }

  for (const reference of enumReferences.values()) {
    if (reference.kind === 'domain') {
      addEnumDefinition(enumDefinitions, enumNames.get(reference.identity)!, reference, contract);
    }
  }
  const draftByQualifiedName = new Map<string, ModelDraft>(
    sources.map((source, index) => [`${source.namespace}.${source.name}`, drafts[index]!] as const)
  );
  for (const [index, source] of sources.entries()) {
    const draft = drafts[index]!;
    for (const [relationName, relation] of Object.entries(draft.source.relations ?? {})) {
      const target = draftByQualifiedName.get(`${relation.to.namespace}.${relation.to.model}`);
      if (!target) {
        throw new Error(
          `Relation ${source.namespace}.${source.name}.${relationName} references an unknown model ${relation.to.namespace}.${relation.to.model}`
        );
      }
      draft.fields.push(relationField(relationName, relation, target.name));
    }
  }

  return {
    datamodel: {
      models: drafts.map((draft) => ({
        name: draft.name,
        dbName: draft.dbName === draft.name ? null : draft.dbName,
        schema: draft.namespace,
        fields: draft.fields,
        uniqueFields: [],
        uniqueIndexes: [],
        primaryKey: draft.primaryKey,
      })),
      enums: Array.from(enumDefinitions.values()).sort((a, b) => a.name.localeCompare(b.name)),
      types: [],
      indexes: [],
    },
    schema: EMPTY_SCHEMA,
    mappings: EMPTY_MAPPINGS,
  };
}

function assignNames(items: ReadonlyArray<{ base: string; key: string; qualifier: string }>) {
  const counts = new Map<string, number>();
  for (const { base } of items) counts.set(base, (counts.get(base) ?? 0) + 1);

  const assigned = new Map<string, string>();
  const usedRaw = new Set<string>();
  const usedEmitted = new Set<string>();
  const reserve = (item: { base: string; key: string; qualifier: string }, qualified: boolean) => {
    const base = qualified ? `${identifier(item.qualifier)}_${item.base}` : item.base;
    let candidate = base;
    let suffix = 2;
    while (usedRaw.has(candidate) || usedEmitted.has(toPascalCase(candidate))) {
      candidate = `${base}_${suffix++}`;
    }
    assigned.set(item.key, candidate);
    usedRaw.add(candidate);
    usedEmitted.add(toPascalCase(candidate));
  };

  for (const item of items
    .filter(({ base }) => counts.get(base) === 1)
    .sort((a, b) => a.key.localeCompare(b.key))) {
    reserve(item, false);
  }
  for (const item of items
    .filter(({ base }) => counts.get(base)! > 1)
    .sort((a, b) => a.key.localeCompare(b.key))) {
    reserve(item, true);
  }
  return assigned;
}

function identifier(value: string) {
  const normalized = value.replaceAll(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}

function logicalFieldForColumn(model: ContractModel, column: string, modelName: string) {
  for (const [fieldName, storage] of Object.entries(model.storage.fields)) {
    if (storage.column === column) return fieldName;
  }
  throw new Error(`Primary-key column ${column} has no field in ${modelName}`);
}

function enumReferenceFor(
  field: ContractField,
  column: ContractColumn,
  domainNamespace: string,
  storageNamespace: string
): EnumReference | undefined {
  if (field.valueSet?.plane === 'domain' || field.valueSet?.entityKind === 'enum') {
    const namespace = field.valueSet.namespaceId ?? domainNamespace;
    return {
      identity: `domain:${namespace}.${field.valueSet.entityName}`,
      kind: 'domain',
      name: field.valueSet.entityName,
      namespace,
    };
  }

  const valueSet = column.valueSet;
  if (!valueSet && field.type.codecId !== 'pg/enum@1') return undefined;
  if (!valueSet) throw new Error(`Enum field has no valueSet metadata`);
  const namespace = valueSet.namespaceId ?? storageNamespace;
  const storageName = column.typeParams?.typeName?.split('.').at(-1);
  const name = storageName ? storageName.toUpperCase() : valueSet.entityName;
  return {
    identity: `storage:${namespace}.${storageName ?? valueSet.entityName}`,
    kind: 'storage',
    name,
    namespace,
    ...(storageName === undefined ? {} : { storageName }),
  };
}

function fieldToDmmfType(
  field: ContractField,
  reference: EnumReference | undefined,
  enumNames: ReadonlyMap<string, string>
) {
  if (reference) {
    return { kind: 'enum', type: enumNames.get(reference.identity)!, nativeType: null } as const;
  }

  switch (field.type.codecId) {
    case 'sql/text@1':
    case 'sql/char@1':
    case 'sql/varchar@1':
    case 'pg/text@1':
    case 'pg/char@1':
    case 'pg/varchar@1':
    case 'pg/inet@1':
    case 'pg/bit@1':
    case 'pg/varbit@1':
    case 'pg/date-string@1':
    case 'pg/time-string@1':
    case 'pg/timetz@1':
      return { kind: 'scalar', type: 'String', nativeType: null } as const;
    case 'sql/int@1':
    case 'pg/int@1':
    case 'pg/int2@1':
    case 'pg/int4@1':
      return { kind: 'scalar', type: 'Int', nativeType: null } as const;
    case 'pg/int8@1':
    case 'pg/unboundedint@1':
    case 'pg/int8number@1':
      return { kind: 'scalar', type: 'BigInt', nativeType: null } as const;
    case 'sql/float@1':
    case 'pg/float@1':
    case 'pg/float4@1':
    case 'pg/float8@1':
      return { kind: 'scalar', type: 'Float', nativeType: null } as const;
    case 'pg/numeric@1':
      return { kind: 'scalar', type: 'Decimal', nativeType: null } as const;
    case 'pg/bool@1':
      return { kind: 'scalar', type: 'Boolean', nativeType: null } as const;
    case 'pg/bytea@1':
      return { kind: 'scalar', type: 'Bytes', nativeType: null } as const;
    case 'pg/date-temporal@1':
    case 'pg/time-temporal@1':
      return { kind: 'scalar', type: 'String', nativeType: null } as const;
    case 'pg/timestamp-string@1':
    case 'pg/timestamptz-string@1':
    case 'pg/timestamp-temporal@1':
    case 'pg/timestamptz-temporal@1':
      return { kind: 'scalar', type: 'DateTime', nativeType: null } as const;
    case 'pg/interval@1':
      return { kind: 'scalar', type: 'Interval', nativeType: null } as const;
    case 'pg/json@1':
    case 'pg/jsonb@1':
      return { kind: 'scalar', type: 'Json', nativeType: null } as const;
    case 'pg/uuid@1':
      return { kind: 'scalar', type: 'String', nativeType: ['Uuid', []] } as const;
    default:
      throw new Error(`Unsupported Prisma contract codec ${field.type.codecId}`);
  }
}

function addEnumDefinition(
  enums: Map<string, DMMF.DatamodelEnum>,
  enumName: string,
  reference: EnumReference,
  contract: Contract
) {
  if (enums.has(enumName)) return;
  if (reference.kind === 'domain') {
    const definition = contract.domain.namespaces[reference.namespace]?.enum?.[reference.name];
    if (!definition) {
      throw new Error(`Missing domain enum ${reference.namespace}.${reference.name}`);
    }
    enums.set(enumName, {
      name: enumName,
      dbName: null,
      values: definition.members.map(({ name, value }) => ({
        name: enumMemberName(name),
        dbName: enumValue(value, `domain enum ${reference.namespace}.${reference.name}`),
      })),
    } as unknown as DMMF.DatamodelEnum);
    return;
  }

  const namespace = contract.storage.namespaces[reference.namespace];
  if (!namespace) throw new Error(`Missing storage namespace ${reference.namespace}`);
  const native = findNativeEnum(namespace, reference);
  if (native) {
    enums.set(enumName, {
      name: enumName,
      dbName: reference.storageName === enumName ? null : (reference.storageName ?? null),
      values: native.members.map((member) => ({ name: enumMemberName(member), dbName: member })),
    });
    return;
  }

  const valueSet = namespace.entries.valueSet?.[reference.name];
  if (!valueSet) {
    throw new Error(`Missing storage valueSet ${reference.namespace}.${reference.name}`);
  }
  enums.set(enumName, {
    name: enumName,
    dbName: null,
    values: valueSet.values.map((value) => {
      const stored = enumValue(value, `storage valueSet ${reference.namespace}.${reference.name}`);
      return { name: enumMemberName(stored), dbName: stored };
    }),
  } as unknown as DMMF.DatamodelEnum);
}

function findNativeEnum(namespace: StorageNamespace, reference: EnumReference) {
  return Object.entries(namespace.entries.native_enum ?? {}).find(
    ([name, value]) =>
      name === reference.storageName ||
      name === reference.name ||
      value.typeName === reference.storageName ||
      value.typeName === reference.name
  )?.[1];
}

function enumValue(value: unknown, context: string): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  throw new Error(`Unsupported ${context} value ${JSON.stringify(value)}`);
}

function enumMemberName(value: string | number) {
  const normalized = String(value).replaceAll(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}

function relationField(name: string, relation: Relation, targetName: string): DMMF.Field {
  const ownsForeignKey = relation.cardinality === 'N:1';
  return {
    kind: 'object',
    name,
    isRequired: ownsForeignKey,
    isList: relation.cardinality === '1:N',
    isUnique: false,
    isId: false,
    isReadOnly: false,
    type: targetName,
    dbName: null,
    hasDefaultValue: false,
    relationFromFields: ownsForeignKey ? Array.from(relation.on.localFields) : [],
    relationToFields: ownsForeignKey ? Array.from(relation.on.targetFields) : [],
    relationName: name,
  };
}
