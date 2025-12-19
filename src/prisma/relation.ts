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
    for (const field of model.fields) {
      if (!isImplicitManyToManyField(field)) {
        continue;
      }

      // Get the related model
      const relatedModel = models.find((m) => m.name === field.type);
      if (!relatedModel) {
        continue;
      }

      // Check if the relation is reciprocal (both sides are lists)
      const relatedField = relatedModel.fields.find(
        (f) => f.relationName === field.relationName && f.isList === true
      );

      if (!relatedField || !isImplicitManyToManyField(relatedField)) {
        // Not a true implicit m-n relation
        continue;
      }

      // Skip self-relations (both sides point to same model)
      if (model.name === relatedModel.name) {
        continue;
      }

      // Use Prisma's relation name for table naming
      // For custom @relation("name"), Prisma creates _name
      // For default relations, Prisma creates _ModelAToModelB
      // Note: relationName should always be defined for implicit m-n relations
      if (!field.relationName) {
        continue;
      }

      const tableName = `_${field.relationName}`;
      const relationName = field.relationName;

      // Skip if we've already processed this relation
      if (joinTables.has(relationName)) {
        continue;
      }

      // Keep alphabetical ordering for A/B column assignment
      const modelNames = [model.name, relatedModel.name].sort();

      // Extract ID field types
      const modelAIdField = getModelIdField(models.find((m) => m.name === modelNames[0])!);
      const modelBIdField = getModelIdField(models.find((m) => m.name === modelNames[1])!);

      joinTables.set(relationName, {
        tableName,
        relationName,
        modelA: modelNames[0],
        modelB: modelNames[1],
        columnAType: modelAIdField.type,
        columnBType: modelBIdField.type,
        columnAIsUuid: isUuidField(modelAIdField),
        columnBIsUuid: isUuidField(modelBIdField),
      });
    }
  }

  return Array.from(joinTables.values());
}
