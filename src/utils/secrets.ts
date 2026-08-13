/**
 * Helpers for keeping secrets out of terminal output.
 */

export function maskSecret(value: string | undefined): string {
  if (!value) {
    return '';
  }
  if (value.length <= 8) {
    return '****';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Return a copy of a config object with apiKey masked, so `config show`
 * never prints a live secret to the terminal.
 */
export function redactApiKey(config: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(config);
  const ai = copy.ai;
  if (ai && typeof ai === 'object' && typeof (ai as Record<string, unknown>).apiKey === 'string') {
    (ai as Record<string, unknown>).apiKey = maskSecret(
      (ai as Record<string, unknown>).apiKey as string
    );
  }
  return copy;
}
