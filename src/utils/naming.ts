/**
 * Naming utilities for consistent TypeScript identifier generation
 */

/**
 * Convert any string to PascalCase for TypeScript type names
 * Handles: snake_case, camelCase, kebab-case, or mixed formats
 *
 * @example
 * toPascalCase('user') // 'User'
 * toPascalCase('session_model_preference') // 'SessionModelPreference'
 * toPascalCase('user-profile') // 'UserProfile'
 * toPascalCase('userProfile') // 'UserProfile'
 */
export function toPascalCase(str: string): string {
  // Handle empty string
  if (!str) return str;

  // Split on underscores, dashes, or spaces
  const words = str.split(/[_-\s]+/);

  // If no delimiters found, check if already camelCase/PascalCase
  if (words.length === 1) {
    // Split camelCase/PascalCase by capital letters
    const camelWords = str.split(/(?=[A-Z])/);
    if (camelWords.length > 1) {
      return camelWords
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    }
    // Single word - just capitalize first letter
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Convert each word to PascalCase
  return words
    .filter((word) => word.length > 0) // Remove empty strings
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
