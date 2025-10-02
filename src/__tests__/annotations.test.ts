import { extractEffectTypeOverride } from '../utils/annotations';
import type { DMMF } from '@prisma/generator-helper';

describe('Custom Type Annotations', () => {
  describe('extractEffectTypeOverride', () => {
    it('should extract simple @customType annotation', () => {
      const field = {
        documentation: '/// @customType(Schema.String.pipe(Schema.email()))',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe(
        'Schema.String.pipe(Schema.email())',
      );
    });

    it('should handle nested parentheses correctly', () => {
      const field = {
        documentation: '/// @customType(Schema.Array(Schema.Number))',
        name: 'ids',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Schema.Array(Schema.Number)');
    });

    it('should handle deeply nested parentheses', () => {
      const field = {
        documentation:
          '/// @customType(Schema.Array(Schema.Number).pipe(Schema.itemsCount(1536)))',
        name: 'embedding',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe(
        'Schema.Array(Schema.Number).pipe(Schema.itemsCount(1536))',
      );
    });

    it('should extract custom type references', () => {
      const field = {
        documentation: '/// @customType(Vector1536)',
        name: 'embedding',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Vector1536');
    });

    it('should handle branded types', () => {
      const field = {
        documentation: "/// @customType(Schema.String.pipe(Schema.brand('UserId')))",
        name: 'userId',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe(
        "Schema.String.pipe(Schema.brand('UserId'))",
      );
    });

    it('should return null when no documentation', () => {
      const field = {
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBeNull();
    });

    it('should return null when no @customType annotation', () => {
      const field = {
        documentation: '/// This is just a comment',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBeNull();
    });

    it('should reject invalid type (not starting with Schema. or PascalCase)', () => {
      const field = {
        documentation: '/// @customType(invalidType)',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBeNull();
    });

    it('should handle whitespace in annotation', () => {
      const field = {
        documentation: '///   @customType(  Schema.String  )  ',
        name: 'email',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe('Schema.String');
    });

    it('should handle complex piped transforms', () => {
      const field = {
        documentation:
          '/// @customType(Schema.Number.pipe(Schema.positive(), Schema.int(), Schema.brand("PositiveInt")))',
        name: 'age',
      } as DMMF.Field;

      expect(extractEffectTypeOverride(field)).toBe(
        'Schema.Number.pipe(Schema.positive(), Schema.int(), Schema.brand("PositiveInt"))',
      );
    });
  });
});
