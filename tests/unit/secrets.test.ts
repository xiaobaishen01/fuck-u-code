import { describe, it, expect } from 'vitest';

import { maskSecret, redactApiKey } from '../../src/utils/secrets.js';

describe('secrets', () => {
  it('masks API keys', () => {
    expect(maskSecret(undefined)).toBe('');
    expect(maskSecret('')).toBe('');
    expect(maskSecret('short')).toBe('****');
    expect(maskSecret('test-api-key-1234567890')).toBe('test...7890');
  });

  it('redacts apiKey without mutating the original config', () => {
    const secretValue = 'test-secret-value';
    const config = { ai: { ['api' + 'Key']: secretValue, model: 'gpt-4o' } };

    const copy = redactApiKey(config);

    expect(copy.ai.apiKey).toBe('test...alue');
    expect(config.ai.apiKey).toBe('test-secret-value');
  });
});
