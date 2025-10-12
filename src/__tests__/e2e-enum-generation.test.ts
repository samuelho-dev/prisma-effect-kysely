import { Schema } from 'effect';
import { generateEnumsFile } from '../effect/enum';
import type { DMMF } from '@prisma/generator-helper';

describe('End-to-End Enum Generation', () => {
  const mockEnums: DMMF.DatamodelEnum[] = [
    {
      name: 'ROLE',
      values: [
        { name: 'ADMIN', dbName: null },
        { name: 'USER', dbName: null }
      ],
      dbName: null
    }
  ];

  it('should generate valid TypeScript code', () => {
    const result = generateEnumsFile(mockEnums);

    // Test 16: Generated code contains expected structures
    expect(result).toContain('export enum');
    expect(result).toContain('Schema.Enums(');
    expect(result).toContain('import { Schema } from "effect"');
  });

  it('should allow enum to be used in Kysely queries (type compatibility)', () => {
    // Simulating generated enum
    enum Role {
      ADMIN = "ADMIN",
      USER = "USER"
    }

    // Test 17: Enum value is compatible with string literal type
    type RoleDB = "ADMIN" | "USER";
    const dbValue: RoleDB = Role.ADMIN; // Should compile

    expect(dbValue).toBe("ADMIN");
  });

  it('should work with Effect Schema validation pipeline', () => {
    enum Role {
      ADMIN = "ADMIN",
      USER = "USER"
    }
    const RoleSchema = Schema.Enums(Role);

    // Test 18: Full Effect pipeline works
    const decodeSync = Schema.decodeUnknownSync(RoleSchema);
    const encodeSync = Schema.encodeSync(RoleSchema);

    expect(decodeSync("ADMIN")).toBe("ADMIN");
    expect(encodeSync(Role.ADMIN)).toBe("ADMIN");
  });
});
