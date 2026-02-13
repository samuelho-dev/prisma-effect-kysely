import type { DMMF } from '@prisma/generator-helper';

/**
 * Create a properly typed mock DMMF.Document for testing
 * Avoids type coercions by providing complete structure
 */
export function createMockDMMF(
  overrides: {
    enums?: readonly DMMF.DatamodelEnum[];
    models?: readonly DMMF.Model[];
  } = {}
): DMMF.Document {
  const defaultSchema: DMMF.Schema = {
    inputObjectTypes: {
      model: [],
      prisma: [],
    },
    outputObjectTypes: {
      model: [],
      prisma: [],
    },
    enumTypes: {
      model: [],
      prisma: [],
    },
    fieldRefTypes: {
      prisma: [],
    },
  };

  const defaultMappings: DMMF.Mappings = {
    modelOperations: [],
    otherOperations: {
      read: [],
      write: [],
    },
  };

  return {
    datamodel: {
      enums: overrides.enums ?? [],
      models: overrides.models ?? [],
      types: [],
      indexes: [],
    },
    schema: defaultSchema,
    mappings: defaultMappings,
  };
}

/**
 * Create a mock DatamodelEnum for testing
 */
export function createMockEnum(
  name: string,
  values: string[],
  dbName: string | null = null
): DMMF.DatamodelEnum {
  return {
    name,
    values: values.map((v) => ({ name: v, dbName: null })),
    dbName,
  };
}

/**
 * Create a mock Model for testing
 */
export function createMockModel(overrides: Partial<DMMF.Model> & { name: string }): DMMF.Model {
  return {
    name: overrides.name,
    dbName: overrides.dbName ?? null,
    schema: overrides.schema ?? null,
    fields: overrides.fields ?? [],
    primaryKey: overrides.primaryKey ?? null,
    uniqueFields: overrides.uniqueFields ?? [],
    uniqueIndexes: overrides.uniqueIndexes ?? [],
    isGenerated: overrides.isGenerated ?? false,
  };
}

/**
 * Create a mock Field for testing
 */
export function createMockField(overrides: Partial<DMMF.Field> & { name: string }): DMMF.Field {
  return {
    kind: 'scalar',
    type: 'String',
    isList: false,
    isRequired: true,
    isUnique: false,
    isId: false,
    isReadOnly: false,
    hasDefaultValue: false,
    nativeType: null,
    dbName: null,
    isGenerated: false,
    isUpdatedAt: false,
    ...overrides,
  };
}
