import { describe, it } from 'node:test';
import assert from 'node:assert';
import { signJWT, verifyJWT, decodeJWT } from '../src/security/jwt.js';
import { hashPassword, comparePassword } from '../src/security/crypto.js';

describe('Security: JWT', () => {
  const secret = 'test-secret-key-12345';

  it('signs and verifies JWT token', () => {
    const payload = { userId: 123, username: 'john' };
    const token = signJWT(payload, { secret });

    assert.ok(typeof token === 'string');
    assert.ok(token.split('.').length === 3);

    const verified = verifyJWT(token, secret);
    assert.ok(verified);
    assert.strictEqual(verified.userId, 123);
    assert.strictEqual(verified.username, 'john');
  });

  it('includes issued-at and expiration claims', () => {
    const payload = { userId: 123 };
    const token = signJWT(payload, { secret, expiresIn: 3600 });

    const decoded = decodeJWT(token);
    assert.ok(decoded);
    assert.ok(typeof decoded.iat === 'number');
    assert.ok(typeof decoded.exp === 'number');
    assert.ok((decoded.exp as number) > (decoded.iat as number));
    assert.strictEqual((decoded.exp as number) - (decoded.iat as number), 3600);
  });

  it('rejects expired tokens', () => {
    const payload = { userId: 123 };
    const token = signJWT(payload, { secret, expiresIn: -100 });

    const verified = verifyJWT(token, secret);
    assert.strictEqual(verified, null);
  });

  it('rejects tokens signed with different secret', () => {
    const payload = { userId: 123 };
    const token = signJWT(payload, { secret });

    const verified = verifyJWT(token, 'wrong-secret');
    assert.strictEqual(verified, null);
  });

  it('rejects tampered tokens', () => {
    const payload = { userId: 123 };
    const token = signJWT(payload, { secret });

    // Tamper with payload
    const parts = token.split('.');
    parts[1] = parts[1] + 'tampered';
    const tamperedToken = parts.join('.');

    const verified = verifyJWT(tamperedToken, secret);
    assert.strictEqual(verified, null);
  });

  it('decodes token without verification', () => {
    const payload = { userId: 123, role: 'admin' };
    const token = signJWT(payload, { secret });

    const decoded = decodeJWT(token);
    assert.ok(decoded);
    assert.strictEqual(decoded.userId, 123);
    assert.strictEqual(decoded.role, 'admin');
  });

  it('rejects malformed tokens', () => {
    assert.strictEqual(verifyJWT('invalid', secret), null);
    assert.strictEqual(verifyJWT('a.b', secret), null);
    assert.strictEqual(verifyJWT('', secret), null);
  });
});

describe('Security: Password Hashing', () => {
  it('hashes and compares passwords correctly', async () => {
    const password = 'MySecurePassword123!';
    const hash = await hashPassword(password);

    assert.ok(typeof hash === 'string');
    assert.ok(hash.length > 0);
    assert.notStrictEqual(hash, password);

    const isValid = await comparePassword(password, hash);
    assert.strictEqual(isValid, true);
  });

  it('rejects wrong passwords', async () => {
    const password = 'CorrectPassword';
    const hash = await hashPassword(password);

    const isValid = await comparePassword('WrongPassword', hash);
    assert.strictEqual(isValid, false);
  });

  it('generates different hashes for same password', async () => {
    const password = 'SamePassword123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Different salts should produce different hashes
    assert.notStrictEqual(hash1, hash2);
    assert.ok(hash1.includes('$'));
    assert.ok(hash2.includes('$'));
  });

  it('uses appropriate hash format', async () => {
    const password = 'TestPassword';
    const hash = await hashPassword(password);

    // Format: salt_rounds$salt_hex$hash_hex
    const parts = hash.split('$');
    assert.strictEqual(parts.length, 3);
    assert.ok(/^\d+$/.test(parts[0]!)); // salt rounds (number)
    assert.ok(parts[1]!.length > 10); // salt hex
    assert.ok(parts[2]!.length > 20); // hash hex
  });
});
