import { describe, it, expect } from 'vitest';
import type { Health } from '../src/types.js';

describe('types', () => {
  it('Health type should have ok property', () => {
    const health: Health = { ok: true };
    expect(health.ok).toBe(true);
  });
});
