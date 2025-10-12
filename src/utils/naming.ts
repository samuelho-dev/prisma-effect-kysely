/**
 * Naming utilities for consistent TypeScript identifier generation
 */

/**
 * Convert any string to PascalCase with optional suffix
 * Handles: snake_case, camelCase, kebab-case, or mixed formats
 *
 * @param str - The string to convert
 * @param suffix - Optional suffix to append (e.g., "Schema", "Type")
 *
 * @example
 * toPascalCase('user') // 'User'
 * toPascalCase('PRODUCT_STATUS') // 'ProductStatus'
 * toPascalCase('PRODUCT_STATUS', 'Schema') // 'ProductStatusSchema'
 * toPascalCase('USER_ROLE', 'Type') // 'UserRoleType'
 */
export function toPascalCase(str: string, suffix?: string): string {
  // Handle empty string
  if (!str) return str;

  // Split on underscores, dashes, or spaces
  const words = str.split(/[_-\s]+/);

  let pascalCase: string;

  // If no delimiters found, check if already camelCase/PascalCase
  if (words.length === 1) {
    // Split camelCase/PascalCase by capital letters
    const camelWords = str.split(/(?=[A-Z])/);
    if (camelWords.length > 1) {
      pascalCase = camelWords
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    } else {
      // Single word - just capitalize first letter
      pascalCase = str.charAt(0).toUpperCase() + str.slice(1);
    }
  } else {
    // Convert each word to PascalCase
    pascalCase = words
      .filter((word) => word.length > 0) // Remove empty strings
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  return suffix ? `${pascalCase}${suffix}` : pascalCase;
}
