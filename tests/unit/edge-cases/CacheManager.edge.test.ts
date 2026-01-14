/**
 * CacheManager Edge Case Tests
 * Tests for boundary conditions, invalid inputs, and edge scenarios
 */

import { CacheManager } from '../../../src/infrastructure/cache/CacheManager';

describe('CacheManager Edge Cases', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    // Get fresh instance - note: singleton, so we clear it
    cacheManager = CacheManager.getInstance();
    cacheManager.clear();
  });

  describe('TTL Validation', () => {
    it('should use default TTL when given zero', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      cacheManager.set('test', 'value', 0);

      // Should not expire immediately
      const result = cacheManager.get('test');
      expect(result).toBe('value');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid TTL value'));
      warnSpy.mockRestore();
    });

    it('should use default TTL when given negative number', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      cacheManager.set('test', 'value', -1000);

      const result = cacheManager.get('test');
      expect(result).toBe('value');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid TTL value'));
      warnSpy.mockRestore();
    });

    it('should use default TTL when given NaN', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      cacheManager.set('test', 'value', NaN);

      const result = cacheManager.get('test');
      expect(result).toBe('value');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid TTL value'));
      warnSpy.mockRestore();
    });

    it('should use default TTL when given Infinity', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      cacheManager.set('test', 'value', Infinity);

      const result = cacheManager.get('test');
      expect(result).toBe('value');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid TTL value'));
      warnSpy.mockRestore();
    });

    it('should cap TTL at 24 hours', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const thirtyHours = 30 * 60 * 60 * 1000;
      cacheManager.set('test', 'value', thirtyHours);

      // Should still cache the value (with capped TTL)
      const result = cacheManager.get('test');
      expect(result).toBe('value');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TTL exceeds max'));
      warnSpy.mockRestore();
    });

    it('should accept valid positive TTL', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      cacheManager.set('test', 'value', 60000);

      const result = cacheManager.get('test');
      expect(result).toBe('value');
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('clearExpired Safety', () => {
    it('should safely clear expired entries without corrupting cache', () => {
      // Add multiple entries with very short TTL
      cacheManager.set('key1', 'value1', 1); // 1ms TTL
      cacheManager.set('key2', 'value2', 1);
      cacheManager.set('key3', 'value3', 300000); // 5 min TTL

      // Wait for short TTL entries to expire
      return new Promise<void>(resolve => {
        setTimeout(() => {
          cacheManager.clearExpired();

          // Key3 should still exist
          expect(cacheManager.get('key3')).toBe('value3');
          // Expired keys should be gone
          expect(cacheManager.get('key1')).toBeNull();
          expect(cacheManager.get('key2')).toBeNull();
          resolve();
        }, 10);
      });
    });

    it('should handle empty cache', () => {
      expect(() => cacheManager.clearExpired()).not.toThrow();
    });

    it('should handle cache with only expired entries', () => {
      cacheManager.set('expired1', 'value1', 1);
      cacheManager.set('expired2', 'value2', 1);

      return new Promise<void>(resolve => {
        setTimeout(() => {
          cacheManager.clearExpired();
          expect(cacheManager.size()).toBe(0);
          resolve();
        }, 10);
      });
    });
  });

  describe('Edge Cases in Data Types', () => {
    it('should cache null values correctly', () => {
      cacheManager.set('nullKey', null);
      expect(cacheManager.get('nullKey')).toBeNull();
    });

    it('should cache undefined values', () => {
      cacheManager.set('undefinedKey', undefined);
      expect(cacheManager.get('undefinedKey')).toBeUndefined();
    });

    it('should cache complex objects', () => {
      const complexObj = {
        nested: { deep: { value: 42 } },
        array: [1, 2, 3],
        date: new Date(),
      };
      cacheManager.set('complex', complexObj);
      expect(cacheManager.get('complex')).toEqual(complexObj);
    });

    it('should cache empty strings', () => {
      cacheManager.set('empty', '');
      expect(cacheManager.get('empty')).toBe('');
    });

    it('should cache special number values', () => {
      cacheManager.set('zero', 0);
      cacheManager.set('negativeZero', -0);
      expect(cacheManager.get('zero')).toBe(0);
      expect(cacheManager.get('negativeZero')).toBe(-0);
    });
  });

  describe('Key Edge Cases', () => {
    it('should handle empty string keys', () => {
      cacheManager.set('', 'emptyKeyValue');
      expect(cacheManager.get('')).toBe('emptyKeyValue');
    });

    it('should handle keys with special characters', () => {
      const specialKey = 'key:with/special\\chars!@#$%^&*()';
      cacheManager.set(specialKey, 'value');
      expect(cacheManager.get(specialKey)).toBe('value');
    });

    it('should handle very long keys', () => {
      const longKey = 'a'.repeat(10000);
      cacheManager.set(longKey, 'value');
      expect(cacheManager.get(longKey)).toBe('value');
    });

    it('should handle unicode keys', () => {
      const unicodeKey = '键🔑キー';
      cacheManager.set(unicodeKey, 'value');
      expect(cacheManager.get(unicodeKey)).toBe('value');
    });
  });
});
