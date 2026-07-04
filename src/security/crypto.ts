import * as crypto from 'crypto';

const SALT_ROUNDS = 10;
const HASH_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    
    crypto.scrypt(password, salt, HASH_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${SALT_ROUNDS}$${salt.toString('hex')}$${derivedKey.toString('hex')}`);
    });
  });
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = hash.split('$');
    if (parts.length !== 3) {
      resolve(false);
      return;
    }

    const [, saltHex, hashHex] = parts;
    if (!saltHex || !hashHex) {
      resolve(false);
      return;
    }
    
    const salt = Buffer.from(saltHex, 'hex');
    const storedHash = Buffer.from(hashHex, 'hex');

    crypto.scrypt(password, salt, HASH_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      
      const derivedKeyBuffer = Buffer.from(derivedKey);
      if (derivedKeyBuffer.length !== storedHash.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(derivedKeyBuffer, storedHash));
    });
  });
}

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function verifyHash(value: string, hash: string): boolean {
  const computedHash = hashValue(value);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}
