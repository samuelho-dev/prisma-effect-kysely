import type { DMMF } from '@prisma/generator-helper';
import { isUuidField } from './type.js';

/**
 * Metadata for implicit many-to-many join tables
 */
export interface JoinTableInfo {
  /** Table name in database (e.g., "_CategoryToPost") */
  tableName: string;
  /** Relation name without underscore (e.g., "CategoryToPost") */
  relationName: string;
  /** First model name (alphabetically) */
  modelA: string;
  /** Second model name (alphabetically) */
  modelB: string;
  /** Type of column A (from modelA's ID field) */
  columnAType: string;
  /** Type of column B (from modelB's ID field) */
  columnBType: string;
  /** Whether column A is a UUID */
  columnAIsUuid: boolean;
  /** Whether column B is a UUID */
  columnBIsUuid: boolean;
}

/**
 * Detect if a relation field is part of an implicit many-to-many relation
 * Criteria:
 * - kind === "object" (relation field)
 * - isList === true (many side)
 * - relationFromFields is empty (no foreign key on this side)
 * - relationToFields is empty (no explicit relation table)
 */
function isImplicitManyToManyField(field: DMMF.Field) {
  return (
    field.kind === 'object' &&
    field.isList === true &&
    field.relationFromFields !== undefined &&
    field.relationFromFields.length === 0 &&
    field.relationToFields !== undefined &&
    field.relationToFields.length === 0
  );
}

/**
 * Get the ID field from a model
 * Handles both single @id and composite @@id
 */
export function getModelIdField(model: DMMF.Model): DMMF.Field {
  // Try to find single @id field
  const idField = model.fields.find((f) => f.isId === true);
  if (idField) {
    return idField;
  }

  // For composite @@id, get the first field from primaryKey
  if (model.primaryKey && model.primaryKey.fields.length > 0) {
    const firstIdFieldName = model.primaryKey.fields[0];
    const field = model.fields.find((f) => f.name === firstIdFieldName);
    if (field) {
      return field;
    }
  }

  throw new Error(`Model ${model.name} has no ID field (@id or @@id required)`);
}

/**
 * Detect all implicit many-to-many relations from DMMF models
 * Returns metadata for generating join table schemas
 */
export function detectImplicitManyToMany(models: readonly DMMF.Model[]): JoinTableInfo[] {
  const joinTables = new Map<string, JoinTableInfo>();

  for (const model of models) {
    const validFields = model.fields.filter((field) => shouldProcessField(field, model, models));

    for (const field of validFields) {
      const relatedModel = models.find((m) => m.name === field.type);
      if (!(relatedModel && isValidImplicitRelation(field, relatedModel))) {
        continue;
      }

      if (!field.relationName || joinTables.has(field.relationName)) {
        continue;
      }

      const joinTableInfo = createJoinTableInfo(field, model, relatedModel, models);
      if (joinTableInfo) {
        joinTables.set(field.relationName, joinTableInfo);
      }
    }
  }

  return Array.from(joinTables.values());
}

function shouldProcessField(
  field: DMMF.Field,
  model: DMMF.Model,
  models: readonly DMMF.Model[]
): boolean {
  if (!isImplicitManyToManyField(field)) {
    return false;
  }

  const relatedModel = models.find((m) => m.name === field.type);
  return !!(relatedModel && model.name !== relatedModel.name);
}

function createJoinTableInfo(
  field: DMMF.Field,
  model: DMMF.Model,
  relatedModel: DMMF.Model,
  models: readonly DMMF.Model[]
): JoinTableInfo | null {
  const modelNames = [model.name, relatedModel.name].sort();
  const modelA = models.find((m) => m.name === modelNames[0]);
  const modelB = models.find((m) => m.name === modelNames[1]);

  if (!(modelA && modelB)) {
    return null;
  }

  const modelAIdField = getModelIdField(modelA);
  const modelBIdField = getModelIdField(modelB);
  const relationName = field.relationName;

  if (!relationName) {
    return null;
  }

  return {
    tableName: `_${relationName}`,
    relationName,
    modelA: modelNames[0],
    modelB: modelNames[1],
    columnAType: modelAIdField.type,
    columnBType: modelBIdField.type,
    columnAIsUuid: isUuidField(modelAIdField),
    columnBIsUuid: isUuidField(modelBIdField),
  };
}

function isValidImplicitRelation(field: DMMF.Field, relatedModel: DMMF.Model): boolean {
  const relatedField = relatedModel.fields.find(
    (f) => f.relationName === field.relationName && f.isList === true
  );

  return !!(relatedField && isImplicitManyToManyField(relatedField));
}
