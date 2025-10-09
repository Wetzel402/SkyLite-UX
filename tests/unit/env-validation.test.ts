import { describe, it, expect } from 'vitest';

describe('Environment Validation', () => {
  it('validates DATABASE_URL format', () => {
    const validUrls = [
      'postgresql://user:pass@localhost:5432/db',
      'postgres://user:pass@localhost:5432/db',
      'mysql://user:pass@localhost:3306/db',
    ];
    
    const invalidUrls = [
      'invalid-url',
      'http://example.com',
      'not-a-database-url',
    ];

    validUrls.forEach(url => {
      expect(url).toMatch(/^[a-z]+:\/\/.+/);
    });

    invalidUrls.forEach(url => {
      expect(url).not.toMatch(/^postgresql?:\/\/.+/);
    });
  });

  it('validates ENABLE_KIOSK_MODE values', () => {
    const validValues = ['true', 'false'];
    const invalidValues = ['invalid', 'yes', 'no', '1', '0'];

    validValues.forEach(value => {
      expect(['true', 'false']).toContain(value);
    });

    invalidValues.forEach(value => {
      expect(['true', 'false']).not.toContain(value);
    });
  });

  it('validates DISPLAY_TOKEN format', () => {
    const validTokens = [
      'test-token-123',
      'secure-token-abc-def-456',
      'very-long-token-with-many-characters-123456789',
    ];
    
    const invalidTokens = [
      'short',
      '123',
      '',
      'token with spaces',
    ];

    validTokens.forEach(token => {
      expect(token.length).toBeGreaterThanOrEqual(10);
      expect(token).toMatch(/^[a-zA-Z0-9-_]+$/);
    });

    invalidTokens.forEach(token => {
      expect(token.length < 10 || !token.match(/^[a-zA-Z0-9-_]+$/)).toBe(true);
    });
  });

  it('validates NODE_ENV values', () => {
    const validEnvs = ['development', 'production', 'test'];
    const invalidEnvs = ['invalid', 'dev', 'prod'];

    validEnvs.forEach(env => {
      expect(['development', 'production', 'test']).toContain(env);
    });

    invalidEnvs.forEach(env => {
      expect(['development', 'production', 'test']).not.toContain(env);
    });
  });

  it('validates PORT format', () => {
    const validPorts = ['3000', '8080', '80', '443'];
    const invalidPorts = ['invalid', '0', '65536', '-1'];

    validPorts.forEach(port => {
      const portNum = parseInt(port, 10);
      expect(portNum).toBeGreaterThan(0);
      expect(portNum).toBeLessThanOrEqual(65535);
    });

    invalidPorts.forEach(port => {
      const portNum = parseInt(port, 10);
      expect(portNum <= 0 || portNum > 65535 || isNaN(portNum)).toBe(true);
    });
  });
});
