import { toPascalCase, toSnakeCase } from '../utils/naming';

describe('Naming Utilities', () => {
  describe('toPascalCase', () => {
    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('user')).toBe('User');
      expect(toPascalCase('user_profile')).toBe('UserProfile');
      expect(toPascalCase('session_model_preference')).toBe('SessionModelPreference');
      expect(toPascalCase('very_long_model_name')).toBe('VeryLongModelName');
    });

    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('user-profile')).toBe('UserProfile');
      expect(toPascalCase('session-model-preference')).toBe('SessionModelPreference');
    });

    it('should handle camelCase input', () => {
      expect(toPascalCase('userProfile')).toBe('UserProfile');
      expect(toPascalCase('sessionModelPreference')).toBe('SessionModelPreference');
    });

    it('should handle already PascalCase input', () => {
      expect(toPascalCase('User')).toBe('User');
      expect(toPascalCase('UserProfile')).toBe('UserProfile');
      expect(toPascalCase('SessionModelPreference')).toBe('SessionModelPreference');
    });

    it('should handle single word', () => {
      expect(toPascalCase('user')).toBe('User');
      expect(toPascalCase('User')).toBe('User');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });

    it('should handle mixed case with multiple delimiters', () => {
      expect(toPascalCase('user_profile-setting')).toBe('UserProfileSetting');
      expect(toPascalCase('user profile')).toBe('UserProfile');
    });

    it('should handle consecutive delimiters', () => {
      expect(toPascalCase('user__profile')).toBe('UserProfile');
      expect(toPascalCase('user--profile')).toBe('UserProfile');
    });

    it('should handle real-world model names', () => {
      expect(toPascalCase('AllTypes')).toBe('AllTypes');
      expect(toPascalCase('CompositeIdModel')).toBe('CompositeIdModel');
      expect(toPascalCase('session_model_preference')).toBe('SessionModelPreference');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('User')).toBe('user');
      expect(toSnakeCase('UserProfile')).toBe('user_profile');
      expect(toSnakeCase('SessionModelPreference')).toBe('session_model_preference');
    });

    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('user')).toBe('user');
      expect(toSnakeCase('userProfile')).toBe('user_profile');
      expect(toSnakeCase('sessionModelPreference')).toBe('session_model_preference');
    });

    it('should handle single word', () => {
      expect(toSnakeCase('user')).toBe('user');
      expect(toSnakeCase('User')).toBe('user');
    });

    it('should handle empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });

    it('should handle real-world model names for join tables', () => {
      expect(toSnakeCase('Product')).toBe('product');
      expect(toSnakeCase('ProductTag')).toBe('product_tag');
      expect(toSnakeCase('Category')).toBe('category');
      expect(toSnakeCase('Post')).toBe('post');
    });

    it('should generate correct column names for join tables', () => {
      // Simulating join table column name generation
      const modelA = 'Product';
      const modelB = 'ProductTag';
      expect(`${toSnakeCase(modelA)}_id`).toBe('product_id');
      expect(`${toSnakeCase(modelB)}_id`).toBe('product_tag_id');
    });
  });
});
