import { describe, it, expect } from 'vitest';
import { sanitizeBranch, nextBranch, MAX_BRANCH_LEN, MAX_SUFFIX } from '../src/composer/branch.js';

describe('composer.branch', () => {
  describe('sanitizeBranch', () => {
    it('should sanitize basic branch names', () => {
      expect(sanitizeBranch('feat/run-123')).toBe('feat/run-123');
      expect(sanitizeBranch('bugfix/important-fix')).toBe('bugfix/important-fix');
    });

    it('should handle punctuation and special characters', () => {
      expect(sanitizeBranch('feat/run-123!@#$%^&*()')).toBe('feat/run-123');
      expect(sanitizeBranch('bugfix/important fix with spaces')).toBe(
        'bugfix/important-fix-with-spaces',
      );
    });

    it('should handle unicode and non-ascii characters', () => {
      expect(sanitizeBranch('feat/run-123-🚀-emoji')).toBe('feat/run-123-emoji');
      expect(sanitizeBranch('bugfix/中文测试')).toBe('bugfix');
    });

    it('should handle very long inputs', () => {
      const longName = 'a'.repeat(100);
      const result = sanitizeBranch(longName);
      expect(result.length).toBeLessThanOrEqual(MAX_BRANCH_LEN);
      expect(result).toBe('a'.repeat(MAX_BRANCH_LEN));
    });

    it('should handle empty and edge cases', () => {
      expect(sanitizeBranch('')).toBe('head');
      expect(sanitizeBranch('   ')).toBe('head');
      expect(sanitizeBranch('---')).toBe('head');
      expect(sanitizeBranch('///')).toBe('head');
    });

    it('should collapse repeated dashes and slashes', () => {
      expect(sanitizeBranch('feat///run---123')).toBe('feat/run-123');
      expect(sanitizeBranch('bugfix//important--fix')).toBe('bugfix/important-fix');
    });

    it('should trim leading and trailing dashes and slashes', () => {
      expect(sanitizeBranch('/feat/run-123/')).toBe('feat/run-123');
      expect(sanitizeBranch('-bugfix-important-fix-')).toBe('bugfix-important-fix');
    });
  });

  describe('nextBranch', () => {
    it('should return base name if it does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exists = async (name: string) => false;
      const result = await nextBranch('feat/run-123', exists);
      expect(result).toBe('feat/run-123');
    });

    it('should add suffix if base exists', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exists = async (name: string) => name === 'feat/run-123';
      const result = await nextBranch('feat/run-123', exists);
      expect(result).toBe('feat/run-123-2');
    });

    it('should increment suffix for multiple collisions', async () => {
      const existingBranches = new Set(['feat/run-123', 'feat/run-123-2', 'feat/run-123-3']);
      const exists = async (name: string) => existingBranches.has(name);
      const result = await nextBranch('feat/run-123', exists);
      expect(result).toBe('feat/run-123-4');
    });

    it('should handle edge case with many existing branches', async () => {
      const existingBranches = new Set();
      for (let i = 1; i <= MAX_SUFFIX - 1; i++) {
        existingBranches.add(`feat/run-123${i > 1 ? `-${i}` : ''}`);
      }
      const exists = async (name: string) => existingBranches.has(name);
      const result = await nextBranch('feat/run-123', exists);
      expect(result).toBe(`feat/run-123-${MAX_SUFFIX}`);
    });

    it('should throw error if too many collisions', async () => {
      const existingBranches = new Set();
      for (let i = 1; i <= MAX_SUFFIX + 1; i++) {
        existingBranches.add(`feat/run-123${i > 1 ? `-${i}` : ''}`);
      }
      const exists = async (name: string) => existingBranches.has(name);

      await expect(nextBranch('feat/run-123', exists)).rejects.toThrow(
        'branch_collision_limit_exceeded',
      );
    });

    it('should handle async exists function errors gracefully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exists = async (name: string) => {
        throw new Error('network error');
      };

      await expect(nextBranch('feat/run-123', exists)).rejects.toThrow('network error');
    });
  });
});
