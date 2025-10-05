import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { formatCode } from './templates';

/**
 * Manages file system operations for the generator
 */
export class FileManager {
  constructor(private readonly outputPath: string) {}

  /**
   * Ensure the output directory exists
   */
  async ensureDirectory() {
    await mkdir(this.outputPath, { recursive: true });
  }

  /**
   * Write a file with automatic code formatting
   */
  async writeFile(filename: string, content: string) {
    const formatted = await formatCode(content);
    const filePath = join(this.outputPath, filename);
    await writeFile(filePath, formatted);
  }

  /**
   * Get the output path
   */
  getOutputPath() {
    return this.outputPath;
  }
}
