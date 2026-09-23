import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { generateEnumSchema, generateEnumsFile } from '../effect/enum';
import { EffectGenerator } from '../effect/generator';
import { buildFieldType } from '../effect/type';
import type { PrismaEnumDefinition } from '../prisma/enum';
import { createMockDMMF, createMockField, createMockModel } from './helpers/dmmf-mocks';

describe('enum generation', () => {
  it('validates and encodes raw stored literals', () => {
    const status = Schema.Literals(['active', 'inactive'] as const);

    expect(Schema.decodeUnknownSync(status)('active')).toBe('active');
    expect(Schema.encodeSync(status)('inactive')).toBe('inactive');
    expect(() => Schema.decodeUnknownSync(status)('ACTIVE')).toThrow();
  });

  it('emits stored string and integer literals without TypeScript enum wrappers', () => {
    const status = {
      name: 'TaskStatus',
      values: [
        { name: 'TODO', dbName: 'todo_db' },
        { name: 'DONE', dbName: 'done_db' },
      ],
    } satisfies PrismaEnumDefinition;
    const priority = {
      name: 'Priority',
      values: [
        { name: 'LOW', dbName: 1 },
        { name: 'HIGH', dbName: 2 },
      ],
    } satisfies PrismaEnumDefinition;

    expect(generateEnumSchema(status)).toBe(
      `export const TaskStatus = Schema.Literals(["todo_db", "done_db"]);
export type TaskStatus = typeof TaskStatus.Type;`
    );
    expect(generateEnumSchema(priority)).toBe(
      `export const Priority = Schema.Literals([1, 2]);
export type Priority = typeof Priority.Type;`
    );
  });

  it('writes schemas, not enum wrappers', () => {
    const generated = generateEnumsFile([
      {
        name: 'STATUS',
        values: [{ name: 'ACTIVE', dbName: null }],
        dbName: null,
      },
    ]);

    expect(generated).toContain('export const STATUS = Schema.Literals(["ACTIVE"])');
    expect(generated).not.toContain('export enum');
  });
});

describe('Effect field generation', () => {
  const dmmf = createMockDMMF({
    enums: [
      {
        name: 'PRODUCT_STATUS',
        values: [
          { name: 'ACTIVE', dbName: null },
          { name: 'DRAFT', dbName: null },
        ],
        dbName: null,
      },
    ],
  });

  it('maps enum fields to their generated schema', () => {
    const field = createMockField({
      name: 'status',
      kind: 'enum',
      type: 'PRODUCT_STATUS',
    });

    expect(buildFieldType(field, dmmf)).toBe('ProductStatus');
  });

  it('keeps a custom primary-key refinement before branding', () => {
    const id = createMockField({
      name: 'id',
      type: 'Int',
      isId: true,
      documentation: '/// @customType(Schema.Int.check(Schema.isGreaterThan(0)))',
    });
    const model = createMockModel({ name: 'Sequence', fields: [id] });
    const source = new EffectGenerator(createMockDMMF({ models: [model] })).generateBrandedIdSchema(
      model,
      model.fields
    );
    if (!source) throw new Error('expected a branded primary-key schema');

    const SequenceId = new Function(
      'Schema',
      `${source.replace('export const', 'const').replace(/\nexport type.*;/, '')}; return SequenceId;`
    )(Schema);

    expect(Schema.decodeUnknownSync(SequenceId)(1)).toBe(1);
    expect(() => Schema.decodeUnknownSync(SequenceId)(0)).toThrow();
  });

  it('maps intervals to the PostgreSQL driver identity struct', () => {
    expect(buildFieldType(createMockField({ name: 'duration', type: 'Interval' }), dmmf)).toBe(
      'Schema.Struct({ months: Schema.Int, days: Schema.Int, micros: Schema.BigInt })'
    );
  });
});
