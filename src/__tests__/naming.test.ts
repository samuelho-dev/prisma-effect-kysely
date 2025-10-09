import { toPascalCase } from '../utils/naming';

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
});
