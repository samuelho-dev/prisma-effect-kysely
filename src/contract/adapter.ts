import type { DMMF } from '@prisma/generator-helper';
import { Schema } from 'effect';
import { parseCustomTypeAnnotations } from '../utils/annotations.js';

const OptionalString = Schema.optionalKey(Schema.String);
const OptionalBoolean = Schema.optionalKey(Schema.Boolean);
const TypeParams = Schema.Struct({ typeName: OptionalString });
const ValueSet = Schema.Struct({ entityName: Schema.String });
const FieldType = Schema.Struct({
  codecId: Schema.String,
  kind: Schema.String,
  typeParams: Schema.optionalKey(TypeParams),
});
const ContractField = Schema.Struct({
  nullable: Schema.Boolean,
  many: OptionalBoolean,
  type: FieldType,
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
const NativeEnum = Schema.Struct({ members: Schema.Array(Schema.String) });
const StorageNamespace = Schema.Struct({
  entries: Schema.Struct({
    native_enum: Schema.optionalKey(Schema.Record(Schema.String, NativeEnum)),
    table: Schema.Record(Schema.String, ContractTable),
  }),
});
const Contract = Schema.Struct({
  schemaVersion: Schema.String,
  targetFamily: Schema.String,
  target: Schema.String,
  domain: Schema.Struct({
    namespaces: Schema.Record(
      Schema.String,
      Schema.Struct({ models: Schema.Record(Schema.String, ContractModel) })
    ),
  }),
  storage: Schema.Struct({
    namespaces: Schema.Record(Schema.String, StorageNamespace),
  }),
});

type Contract = typeof Contract.Type;
type ContractModel = typeof ContractModel.Type;
type ContractTable = typeof ContractTable.Type;
type ContractField = typeof ContractField.Type;
type ContractColumn = typeof ContractColumn.Type;
type Relation = typeof Relation.Type;

interface ModelDraft {
  readonly namespace: string;
  readonly source: ContractModel;
  readonly table: ContractTable;
  readonly name: string;
  readonly dbName: string;
  readonly fields: DMMF.Field[];
  readonly primaryKey: DMMF.PrimaryKey | null;
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
  const enumDefinitions = new Map<string, DMMF.DatamodelEnum>();
  const drafts: ModelDraft[] = [];
  const modelNames = new Set<string>();
  const tableNames = new Map<string, string>();

  for (const [namespace, domainNamespace] of Object.entries(contract.domain.namespaces)) {
    for (const [name, model] of Object.entries(domainNamespace.models)) {
      const existingTable = tableNames.get(model.storage.table);
      if (existingTable) {
        throw new Error(
          `Duplicate table name across Prisma contract namespaces: ${model.storage.table} (${existingTable}, ${namespace}.${name})`
        );
      }
      tableNames.set(model.storage.table, `${namespace}.${name}`);
      if (modelNames.has(name)) {
        throw new Error(`Duplicate model name across Prisma contract namespaces: ${name}`);
      }
      modelNames.add(name);

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
        const scalar = fieldToDmmfType(field, column);
        if (scalar.kind === 'enum') {
          addEnumDefinition(enumDefinitions, scalar.type, column, storageNamespace);
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
        table,
        name,
        dbName: model.storage.table,
        fields,
        primaryKey:
          primaryKeyFields.length === 0
            ? null
            : { name: table.primaryKey?.name ?? null, fields: primaryKeyFields },
      });
    }
  }

  const joinDrafts = drafts.filter((draft) => draft.dbName.startsWith('_'));
  const regularDrafts = drafts.filter((draft) => !draft.dbName.startsWith('_'));
  const draftByQualifiedName = new Map(
    regularDrafts.map((draft) => [`${draft.namespace}.${draft.name}`, draft] as const)
  );

  for (const draft of regularDrafts) {
    for (const [relationName, relation] of Object.entries(draft.source.relations ?? {})) {
      if (draftByQualifiedName.has(`${relation.to.namespace}.${relation.to.model}`)) {
        draft.fields.push(relationField(relationName, relation));
      }
    }
  }

  for (const join of joinDrafts) {
    validateJoinTable(join, draftByQualifiedName);
    const targets = Object.values(join.source.relations ?? {}).filter(
      (relation) => relation.cardinality === 'N:1'
    );
    const [left, right] = targets;
    if (!left || !right) continue;
    const leftModel = draftByQualifiedName.get(`${left.to.namespace}.${left.to.model}`);
    const rightModel = draftByQualifiedName.get(`${right.to.namespace}.${right.to.model}`);
    if (!leftModel || !rightModel) {
      throw new Error(`Join table ${join.dbName} references an unknown model`);
    }
    const relationName = join.dbName.slice(1);
    leftModel.fields.push(implicitRelationField(relationName, rightModel.name));
    rightModel.fields.push(implicitRelationField(relationName, leftModel.name));
  }

  const models: DMMF.Model[] = regularDrafts.map((draft) => ({
    name: draft.name,
    dbName: draft.dbName === draft.name ? null : draft.dbName,
    schema: draft.namespace,
    fields: draft.fields,
    uniqueFields: [],
    uniqueIndexes: [],
    primaryKey: draft.primaryKey,
  }));

  return {
    datamodel: {
      models,
      enums: Array.from(enumDefinitions.values()).sort((a, b) => a.name.localeCompare(b.name)),
      types: [],
      indexes: [],
    },
    schema: EMPTY_SCHEMA,
    mappings: EMPTY_MAPPINGS,
  };
}

function logicalFieldForColumn(model: ContractModel, column: string, modelName: string) {
  for (const [fieldName, storage] of Object.entries(model.storage.fields)) {
    if (storage.column === column) return fieldName;
  }
  throw new Error(`Primary-key column ${column} has no field in ${modelName}`);
}

function fieldToDmmfType(field: ContractField, column: ContractColumn) {
  const codecId = field.type.codecId;
  switch (codecId) {
    case 'pg/text@1':
    case 'sql/varchar@1':
      return { kind: 'scalar', type: 'String', nativeType: null } as const;
    case 'pg/int4@1':
      return { kind: 'scalar', type: 'Int', nativeType: null } as const;
    case 'pg/float8@1':
      return { kind: 'scalar', type: 'Float', nativeType: null } as const;
    case 'pg/int8@1':
      return { kind: 'scalar', type: 'BigInt', nativeType: null } as const;
    case 'pg/bool@1':
      return { kind: 'scalar', type: 'Boolean', nativeType: null } as const;
    case 'pg/date-temporal@1':
    case 'pg/timestamptz-temporal@1':
      return { kind: 'scalar', type: 'DateTime', nativeType: null } as const;
    case 'pg/jsonb@1':
      return { kind: 'scalar', type: 'Json', nativeType: null } as const;
    case 'pg/uuid@1':
      return { kind: 'scalar', type: 'String', nativeType: ['Uuid', []] } as const;
    case 'pg/enum@1': {
      const logicalName = column.valueSet?.entityName;
      const storageName = column.typeParams?.typeName?.split('.').at(-1);
      const typeName =
        logicalName && /[a-z]/.test(logicalName)
          ? logicalName
          : (storageName?.toUpperCase() ?? logicalName);
      if (!typeName) throw new Error('Enum field has no typeName');
      return { kind: 'enum', type: typeName, nativeType: null } as const;
    }
    default:
      throw new Error(`Unsupported Prisma contract codec ${codecId}`);
  }
}

function addEnumDefinition(
  enums: Map<string, DMMF.DatamodelEnum>,
  enumName: string,
  column: ContractColumn,
  namespace: typeof StorageNamespace.Type
) {
  if (enums.has(enumName)) return;
  const storageName = column.typeParams?.typeName?.split('.').at(-1) ?? enumName;
  const nativeEnum = namespace.entries.native_enum?.[storageName];
  if (!nativeEnum) throw new Error(`Missing storage enum ${storageName}`);
  enums.set(enumName, {
    name: enumName,
    dbName: storageName === enumName ? null : storageName,
    values: nativeEnum.members.map((member) => ({
      name: enumMemberName(member),
      dbName: member,
    })),
  });
}

function enumMemberName(value: string) {
  const normalized = value.replaceAll(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}

function validateJoinTable(join: ModelDraft, models: ReadonlyMap<string, ModelDraft>) {
  const columnNames = Object.keys(join.table.columns).sort();
  const primaryKeyColumns = Array.from(join.table.primaryKey?.columns ?? []).sort();
  const storageColumns = Object.values(join.source.storage.fields)
    .map((field) => field.column)
    .sort();
  if (
    columnNames.join(',') !== 'A,B' ||
    primaryKeyColumns.join(',') !== 'A,B' ||
    storageColumns.join(',') !== 'A,B'
  ) {
    throw new Error(
      `Join table ${join.dbName} must contain only composite-primary-key columns A and B`
    );
  }

  const targets = Object.values(join.source.relations ?? {}).filter(
    (relation) => relation.cardinality === 'N:1'
  );
  if (targets.length !== 2) {
    throw new Error(`Join table ${join.dbName} must have exactly two N:1 relations`);
  }

  const targetByColumn = new Map<string, ModelDraft>();
  for (const relation of targets) {
    const localField = relation.on.localFields[0];
    const targetField = relation.on.targetFields[0];
    const column = localField ? join.source.storage.fields[localField]?.column : undefined;
    const target = models.get(`${relation.to.namespace}.${relation.to.model}`);
    if (
      relation.on.localFields.length !== 1 ||
      relation.on.targetFields.length !== 1 ||
      !column ||
      !target ||
      target.primaryKey?.fields.length !== 1 ||
      target.primaryKey.fields[0] !== targetField
    ) {
      throw new Error(
        `Join table ${join.dbName} relations must target a single-column primary key`
      );
    }
    targetByColumn.set(column, target);
  }

  const alphabeticalTargets = Array.from(targetByColumn.values())
    .map((target) => target.name)
    .sort();
  if (
    targetByColumn.get('A')?.name !== alphabeticalTargets[0] ||
    targetByColumn.get('B')?.name !== alphabeticalTargets[1]
  ) {
    throw new Error(`Join table ${join.dbName} columns A/B must follow Prisma model ordering`);
  }
}

function relationField(name: string, relation: Relation): DMMF.Field {
  const ownsForeignKey = relation.cardinality === 'N:1';
  return {
    kind: 'object',
    name,
    isRequired: ownsForeignKey,
    isList: relation.cardinality === '1:N',
    isUnique: false,
    isId: false,
    isReadOnly: false,
    type: relation.to.model,
    dbName: null,
    hasDefaultValue: false,
    relationFromFields: ownsForeignKey ? Array.from(relation.on.localFields) : [],
    relationToFields: ownsForeignKey ? Array.from(relation.on.targetFields) : [],
    relationName: name,
  };
}

function implicitRelationField(relationName: string, targetModel: string): DMMF.Field {
  return {
    kind: 'object',
    name: `${relationName}_${targetModel}`,
    isRequired: true,
    isList: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    type: targetModel,
    dbName: null,
    hasDefaultValue: false,
    relationFromFields: [],
    relationToFields: [],
    relationName,
  };
}
