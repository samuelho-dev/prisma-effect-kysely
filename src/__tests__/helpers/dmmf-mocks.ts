import type { DMMF } from '@prisma/generator-helper';

/**
 * Create a properly typed mock DMMF.Document for testing
 * Avoids type coercions by providing complete structure
 */
export function createMockDMMF(overrides: {
  enums?: readonly DMMF.DatamodelEnum[];
  models?: readonly DMMF.Model[];
}): DMMF.Document {
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
 * Create a mock Field for testing
 */
export function createMockField(
  overrides: Partial<DMMF.Field> & { name: string; kind: DMMF.FieldKind; type: string }
): DMMF.Field {
  return {
    name: overrides.name,
    kind: overrides.kind,
    type: overrides.type,
    isList: overrides.isList ?? false,
    isRequired: overrides.isRequired ?? true,
    isUnique: overrides.isUnique ?? false,
    isId: overrides.isId ?? false,
    isReadOnly: overrides.isReadOnly ?? false,
    hasDefaultValue: overrides.hasDefaultValue ?? false,
    relationName: overrides.relationName,
    documentation: overrides.documentation,
    isGenerated: overrides.isGenerated ?? false,
    isUpdatedAt: overrides.isUpdatedAt ?? false,
  };
}
