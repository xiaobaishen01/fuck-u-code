/**
 * Shared rendering helpers for CLI analysis output.
 */

import { writeFile } from 'node:fs/promises';

import type { RuntimeConfig } from '../../config/schema.js';
import { t } from '../../i18n/index.js';
import type { ProjectAnalysisResult } from '../../metrics/types.js';
import { renderMarkdownToTerminal } from '../../utils/markdown.js';
import chalk from 'chalk';
import { ConsoleOutput } from './console.js';
import { HtmlOutput } from './html.js';
import { JsonOutput } from './json.js';
import { MarkdownOutput } from './markdown.js';

/**
 * Write text to a file when an output file is configured; returns whether
 * the text was written to the file (otherwise the caller prints to stdout).
 */
export async function writeTextOutput(text: string, outputFile?: string): Promise<boolean> {
  if (!outputFile) {
    return false;
  }
  await writeFile(outputFile, text, 'utf-8');
  console.log(t('outputWritten', { file: outputFile }));
  return true;
}

/**
 * Render an analysis result in the configured format, writing to a file when
 * requested and falling back to the terminal otherwise.
 */
export async function renderAnalysisResult(
  result: ProjectAnalysisResult,
  runtimeConfig: RuntimeConfig
): Promise<void> {
  const outputFormat = runtimeConfig.output.format;
  const outputFile = runtimeConfig.output.file;

  switch (outputFormat) {
    case 'markdown': {
      const markdown = new MarkdownOutput(runtimeConfig).render(result);
      if (!(await writeTextOutput(markdown, outputFile))) {
        console.log(renderMarkdownToTerminal(markdown));
      }
      break;
    }
    case 'json': {
      const json = new JsonOutput().render(result);
      if (!(await writeTextOutput(json, outputFile))) {
        console.log(json);
      }
      break;
    }
    case 'html': {
      const html = new HtmlOutput(runtimeConfig).render(result);
      if (!(await writeTextOutput(html, outputFile))) {
        console.log(chalk.yellow(t('output_html_requires_file')));
        new ConsoleOutput(runtimeConfig).render(result);
      }
      break;
    }
    default: {
      new ConsoleOutput(runtimeConfig).render(result);
    }
  }
}
