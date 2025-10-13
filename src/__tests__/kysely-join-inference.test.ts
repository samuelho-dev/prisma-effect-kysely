import { Kysely } from 'kysely';
import type { DB } from './generated/types';

/**
 * Test suite for Kysely join type inference with junction tables
 *
 * Issue: Schema.Schema.Encoded<typeof _table> creates complex conditional types
 * that break Kysely's deep type inference for innerJoin() operations.
 *
 * Solution: Use pre-resolved *SelectEncoded types in DB interface
 */
describe('Kysely Join Type Inference', () => {
  it('should allow innerJoin on junction tables without type errors', () => {
    // Type-level test - if this function compiles, the test passes
    function testJoinInference(db: Kysely<DB>) {
      // This should compile without "Type instantiation is excessively deep" errors
      return db
        .selectFrom('ProductTag')
        .innerJoin('_product_tags', '_product_tags.B', 'ProductTag.id')
        .innerJoin('Product', '_product_tags.A', 'Product.id')
        .selectAll();
    }

    type TestQuery = ReturnType<typeof testJoinInference>;

    // Type assertion - if this compiles, the test passes
    expect(true).toBe(true);
  });

  it('should infer correct column types from joined tables', () => {
    // Type-level test - if this function compiles, the test passes
    function testColumnInference(db: Kysely<DB>) {
      return db.selectFrom('_product_tags').select(['A', 'B']);
    }

    type Query = ReturnType<typeof testColumnInference>;
    type QueryType = Awaited<ReturnType<Query['execute']>>[0];
    type ExpectedType = { A: string; B: string };

    // Type-level assertion - this line ensures types are compatible
    const _typeTest: QueryType = {} as ExpectedType;
    const _reverseTest: ExpectedType = {} as QueryType;

    expect(true).toBe(true);
  });

  it('should support complex many-to-many query patterns', () => {
    // Type-level test - if this function compiles, the test passes
    function testComplexQuery(db: Kysely<DB>) {
      return db
        .selectFrom('Product')
        .innerJoin('_product_tags', '_product_tags.A', 'Product.id')
        .innerJoin('ProductTag as tag', '_product_tags.B', 'tag.id')
        .select(['Product.name as productName', 'tag.name as tagName']);
    }

    type Query = ReturnType<typeof testComplexQuery>;
    type ResultType = Awaited<ReturnType<Query['execute']>>[0];

    // Verify result shape compiles
    const _result: ResultType = {
      productName: 'test',
      tagName: 'test',
    };

    expect(true).toBe(true);
  });

  it('should allow multiple junction table joins in single query', () => {
    // Type-level test - if this function compiles, the test passes
    function testMultipleJoins(db: Kysely<DB>) {
      return db
        .selectFrom('Post')
        .innerJoin('_CategoryToPost', '_CategoryToPost.B', 'Post.id')
        .innerJoin('Category', '_CategoryToPost.A', 'Category.id')
        .select(['Post.title', 'Category.name']);
    }

    type Query = ReturnType<typeof testMultipleJoins>;
    type ResultType = Awaited<ReturnType<Query['execute']>>[0];

    expect(true).toBe(true);
  });
});
