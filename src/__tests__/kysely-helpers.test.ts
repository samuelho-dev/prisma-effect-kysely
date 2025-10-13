import { Schema } from 'effect';
import { columnType, generated, getSchemas } from '../kysely/helpers';

describe('Kysely Helpers', () => {
  describe('columnType', () => {
    it('should create a schema with separate select, insert, and update types', () => {
      const schema = columnType(Schema.Number, Schema.Never, Schema.Never);

      // Verify schema has ColumnTypeId annotation
      const symbolKey = Symbol.for('/ColumnTypeId');
      expect(symbolKey in schema.ast.annotations).toBe(true);

      // Verify AST structure - should preserve the select schema's type (NumberKeyword)
      expect(schema.ast._tag).toBe('NumberKeyword');
      expect(typeof schema.pipe).toBe('function');
    });

    it('should store select, insert, and update schemas', () => {
      const selectSchema = Schema.Number;
      const insertSchema = Schema.Never;
      const updateSchema = Schema.Never;

      const schema = columnType(selectSchema, insertSchema, updateSchema);
      const annotations = schema.ast.annotations;
      const symbolKey = Symbol.for('/ColumnTypeId');
      const schemas = annotations[symbolKey] as {
        selectSchema: typeof selectSchema;
        insertSchema: typeof insertSchema;
        updateSchema: typeof updateSchema;
      };

      expect(schemas).toEqual({
        selectSchema,
        insertSchema,
        updateSchema,
      });
    });
  });

  describe('generated', () => {
    it('should create a schema that allows undefined during insert', () => {
      const schema = generated(Schema.Number);

      // Verify schema has GeneratedId annotation
      const symbolKey = Symbol.for('/GeneratedId');
      expect(symbolKey in schema.ast.annotations).toBe(true);

      // Verify it returns a schema with proper structure - should preserve the original schema's type (NumberKeyword)
      expect(schema.ast._tag).toBe('NumberKeyword');
      expect(typeof schema.pipe).toBe('function');
    });
  });

  describe('getSchemas', () => {
    it('should return Selectable, Insertable, and Updateable schemas', () => {
      const baseSchema = Schema.Struct({
        id: Schema.Number,
        name: Schema.String,
      });

      const schemas = getSchemas(baseSchema);

      expect(schemas).toHaveProperty('Selectable');
      expect(schemas).toHaveProperty('Insertable');
      expect(schemas).toHaveProperty('Updateable');
    });
  });

  describe('Runtime Validation', () => {
    describe('Schema Structure', () => {
      it('should filter out Never types in insert schema', () => {
        const baseSchema = Schema.Struct({
          id: columnType(Schema.Number, Schema.Never, Schema.Never),
          name: Schema.String,
        });

        const schemas = getSchemas(baseSchema);

        // id should not be in Insertable since its insert type is Never
        expect(schemas.Insertable.ast._tag).toBe('TypeLiteral');

        // Verify field names - extract outside conditional for eslint
        const insertableAst = schemas.Insertable.ast;
        expect(insertableAst._tag).toBe('TypeLiteral');
        const fieldNames =
          insertableAst._tag === 'TypeLiteral'
            ? insertableAst.propertySignatures.map((p: any) => p.name)
            : [];

        expect(fieldNames).not.toContain('id');
        expect(fieldNames).toContain('name');
      });
    });

    describe('Selectable schema decoding', () => {
      it('should decode valid Selectable data', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        const result = Schema.decodeUnknownSync(schemas.Selectable)({
          id: 123,
          name: 'test',
        });

        expect(result).toEqual({ id: 123, name: 'test' });
      });
    });

    describe('Insertable schema decoding', () => {
      it('should decode Insertable without generated fields', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Should work without 'id' (generated field)
        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
        });

        expect(result).toEqual({ name: 'test' });
      });

      it('should omit fields with Never insert type', () => {
        const baseSchema = Schema.Struct({
          id: columnType(Schema.Number, Schema.Never, Schema.Never),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Should decode without 'id' field
        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
        });

        expect(result).toEqual({ name: 'test' });
      });
    });

    describe('Updateable schema decoding', () => {
      it('should accept partial updates', () => {
        const baseSchema = Schema.Struct({
          id: Schema.Number,
          email: Schema.String,
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Should accept partial update (only email)
        const result = Schema.decodeUnknownSync(schemas.Updateable)({
          email: 'new@example.com',
        });

        expect(result).toEqual({ email: 'new@example.com' });
      });
    });

    describe('Optional type detection (isOptionalType)', () => {
      it('should detect Undefined in Union and make field optional in Insertable', () => {
        const baseSchema = Schema.Struct({
          optional: Schema.Union(Schema.String, Schema.Undefined),
          required: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Should decode without optional field
        const result1 = Schema.decodeUnknownSync(schemas.Insertable)({
          required: 'test',
        });
        expect(result1).toEqual({ required: 'test' });

        // Should also accept optional field if provided
        const result2 = Schema.decodeUnknownSync(schemas.Insertable)({
          optional: 'value',
          required: 'test',
        });
        expect(result2).toEqual({ optional: 'value', required: 'test' });
      });
    });
  });

  describe('Generated Fields - Native Effect Schema Pattern (@effect/sql)', () => {
    describe('generated() fields should be OMITTED from Insertable', () => {
      it('should omit generated fields from Insertable schema entirely', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          session_id: generated(Schema.UUID),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Runtime: generated fields should be ABSENT from insert schema
        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          name: 'test',
          // id and session_id not present in insert schema at all
        });

        expect(result).toEqual({ name: 'test' });
      });

      it('should silently ignore generated fields if provided (Effect Schema behavior)', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Effect Schema's default behavior: extra fields are silently ignored
        const result = Schema.decodeUnknownSync(schemas.Insertable)({
          id: 123, // Extra field - will be ignored
          name: 'test',
        });

        // id is filtered out, only name remains
        expect(result).toEqual({ name: 'test' });
      });

      // Type-level test skipped - this is a code generation issue
      // TypeScript's Schema.Schema.Type inference can't see runtime field filtering
      // The fix requires explicit type generation in src/effect/generator.ts

      it('should have generated fields in Selectable', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Selectable should have ALL fields including generated
        const result = Schema.decodeUnknownSync(schemas.Selectable)({
          id: 123,
          name: 'test',
        });

        expect(result).toEqual({ id: 123, name: 'test' });
      });

      it('should have generated fields in Updateable', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Updateable should have ALL fields (all optional)
        const result = Schema.decodeUnknownSync(schemas.Updateable)({
          id: 123,
        });

        expect(result).toEqual({ id: 123 });
      });
    });

    describe('AST structure verification', () => {
      it('should not have generated fields in Insertable AST', () => {
        const baseSchema = Schema.Struct({
          id: generated(Schema.Number),
          session_id: generated(Schema.UUID),
          name: Schema.String,
        });
        const schemas = getSchemas(baseSchema);

        // Check the AST structure
        const insertableAst = schemas.Insertable.ast;
        expect(insertableAst._tag).toBe('TypeLiteral');

        // Extract field names (TypeScript knows this is TypeLiteral after assertion)
        const fieldNames =
          insertableAst._tag === 'TypeLiteral'
            ? insertableAst.propertySignatures.map((p: any) => p.name)
            : [];

        // Generated fields should be ABSENT
        expect(fieldNames).not.toContain('id');
        expect(fieldNames).not.toContain('session_id');

        // Regular fields should be present
        expect(fieldNames).toContain('name');
      });
    });
  });
});
