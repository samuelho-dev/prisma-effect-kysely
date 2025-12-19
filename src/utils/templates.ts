import * as prettier from 'prettier';

export async function formatCode(code: string) {
  try {
    return await prettier.format(code, {
      parser: 'typescript',
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
      printWidth: 100,
    });
  } catch {
    return code;
  }
}
