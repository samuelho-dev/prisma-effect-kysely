import { toPascalCase, toSnakeCase } from '../utils/naming.js';

/**
 * Naming Utilities - Essential Behavior Tests
 *
 * Tests verify core case conversion behavior:
 * - snake_case → PascalCase
 * - PascalCase → snake_case
 * - Join table column name generation
 */

describe('Naming Utilities', () => {
  describe('toPascalCase', () => {
    it('should convert various formats to PascalCase', () => {
      // snake_case
      expect(toPascalCase('user_profile')).toBe('UserProfile');
      expect(toPascalCase('session_model_preference')).toBe('SessionModelPreference');

      // kebab-case
      expect(toPascalCase('user-profile')).toBe('UserProfile');

      // camelCase
      expect(toPascalCase('userProfile')).toBe('UserProfile');

      // Already PascalCase
      expect(toPascalCase('UserProfile')).toBe('UserProfile');

      // Single word
      expect(toPascalCase('user')).toBe('User');

      // Empty string
      expect(toPascalCase('')).toBe('');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert various formats to snake_case', () => {
      // PascalCase
      expect(toSnakeCase('UserProfile')).toBe('user_profile');
      expect(toSnakeCase('SessionModelPreference')).toBe('session_model_preference');

      // camelCase
      expect(toSnakeCase('userProfile')).toBe('user_profile');

      // Single word
      expect(toSnakeCase('User')).toBe('user');
      expect(toSnakeCase('user')).toBe('user');

      // Empty string
      expect(toSnakeCase('')).toBe('');
    });
  });

  describe('Join Table Use Cases', () => {
    it('should generate correct column names for join tables', () => {
      // Product <-> ProductTag
      expect(toSnakeCase('Product')).toBe('product');
      expect(toSnakeCase('ProductTag')).toBe('product_tag');
      expect(`${toSnakeCase('Product')}_id`).toBe('product_id');
      expect(`${toSnakeCase('ProductTag')}_id`).toBe('product_tag_id');

      // Category <-> Post
      expect(`${toSnakeCase('Category')}_id`).toBe('category_id');
      expect(`${toSnakeCase('Post')}_id`).toBe('post_id');
    });
  });
});
