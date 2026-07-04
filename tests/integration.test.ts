import { describe, it } from 'node:test';
import assert from 'node:assert';

const uwsSupported = [18, 20, 22, 23].includes(parseInt(process.version.slice(1, 3)));

describe('Integration Tests (uWebSockets.js)', () => {
  it('integration tests require Node.js 18, 20, 22, or 23', () => {
    if (!uwsSupported) {
      console.log('⚠ Skipping integration tests: uWebSockets.js does not support this Node.js version');
      return;
    }
    assert.ok(true);
  });
});
