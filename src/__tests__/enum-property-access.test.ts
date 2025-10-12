import { Schema } from 'effect';

describe('Enum Property Access', () => {
  // Simulating generated output
  enum ProductStatus {
    ARCHIVED = "ARCHIVED",
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE"
  }

  const ProductStatusSchema = Schema.Enums(ProductStatus);

  it('should allow property access on enum', () => {
    // Test 7: Property accessor works
    expect(ProductStatus.ACTIVE).toBe("ACTIVE");
    expect(ProductStatus.DRAFT).toBe("DRAFT");
    expect(ProductStatus.ARCHIVED).toBe("ARCHIVED");
  });

  it('should validate enum values with Schema.Enums', () => {
    // Test 8: Schema validation accepts enum values
    const decodeSync = Schema.decodeUnknownSync(ProductStatusSchema);

    expect(decodeSync("ACTIVE")).toBe("ACTIVE");
    expect(decodeSync(ProductStatus.ACTIVE)).toBe("ACTIVE");
  });

  it('should reject invalid enum values', () => {
    // Test 9: Schema validation rejects invalid values
    const decodeSync = Schema.decodeUnknownSync(ProductStatusSchema);

    expect(() => decodeSync("INVALID")).toThrow();
  });

  it('should provide type safety', () => {
    // Test 10: Type inference works correctly
    type ExtractedType = Schema.Schema.Type<typeof ProductStatusSchema>;
    const status: ExtractedType = ProductStatus.ACTIVE;

    expect(status).toBe("ACTIVE");
  });
});
