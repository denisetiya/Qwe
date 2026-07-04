import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './memory.js';

describe('MemoryStore', () => {
  describe('get/set', () => {
    test('stores and retrieves a value', () => {
      const store = new MemoryStore();
      store.set('key1', 'value1');
      assert.equal(store.get('key1'), 'value1');
    });

    test('returns undefined for missing key', () => {
      const store = new MemoryStore();
      assert.equal(store.get('nonexistent'), undefined);
    });

    test('overwrites existing key', () => {
      const store = new MemoryStore();
      store.set('key', 'first');
      store.set('key', 'second');
      assert.equal(store.get('key'), 'second');
    });

    test('stores various types', () => {
      const store = new MemoryStore();
      store.set('str', 'hello');
      store.set('num', 42);
      store.set('bool', true);
      store.set('obj', { nested: true });
      store.set('arr', [1, 2, 3]);
      assert.equal(store.get('str'), 'hello');
      assert.equal(store.get('num'), 42);
      assert.equal(store.get('bool'), true);
      assert.deepEqual(store.get('obj'), { nested: true });
      assert.deepEqual(store.get('arr'), [1, 2, 3]);
    });
  });

  describe('TTL expiration', () => {
    test('returns undefined after TTL expires', async () => {
      const store = new MemoryStore({ ttl: 50 });
      store.set('key', 'value');
      assert.equal(store.get('key'), 'value');
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(store.get('key'), undefined);
    });

    test('per-key TTL overrides default', async () => {
      const store = new MemoryStore({ ttl: 5000 });
      store.set('fast', 'value', 50);
      store.set('slow', 'value');
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(store.get('fast'), undefined);
      assert.equal(store.get('slow'), 'value');
    });

    test('zero TTL means no expiration', async () => {
      const store = new MemoryStore({ ttl: 50 });
      store.set('permanent', 'value', 0);
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(store.get('permanent'), 'value');
    });
  });

  describe('LRU eviction', () => {
    test('evicts oldest entry when maxSize exceeded', () => {
      const store = new MemoryStore({ maxSize: 3, ttl: 0 });
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      store.set('d', 4);
      assert.equal(store.get('a'), undefined);
      assert.equal(store.get('b'), 2);
      assert.equal(store.get('d'), 4);
      assert.equal(store.size(), 3);
    });

    test('accessed entries move to end (not evicted)', () => {
      const store = new MemoryStore({ maxSize: 3, ttl: 0 });
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      store.get('a');
      store.set('d', 4);
      assert.equal(store.get('a'), 1);
      assert.equal(store.get('b'), undefined);
    });

    test('updating existing key does not evict', () => {
      const store = new MemoryStore({ maxSize: 3, ttl: 0 });
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      store.set('a', 10);
      assert.equal(store.get('a'), 10);
      assert.equal(store.size(), 3);
    });
  });

  describe('has', () => {
    test('returns true for existing key', () => {
      const store = new MemoryStore();
      store.set('key', 'value');
      assert.equal(store.has('key'), true);
    });

    test('returns false for missing key', () => {
      const store = new MemoryStore();
      assert.equal(store.has('key'), false);
    });

    test('returns false for expired key', async () => {
      const store = new MemoryStore({ ttl: 50 });
      store.set('key', 'value');
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(store.has('key'), false);
    });
  });

  describe('del', () => {
    test('removes a key', () => {
      const store = new MemoryStore();
      store.set('key', 'value');
      assert.equal(store.del('key'), true);
      assert.equal(store.get('key'), undefined);
    });

    test('returns false for missing key', () => {
      const store = new MemoryStore();
      assert.equal(store.del('nonexistent'), false);
    });
  });

  describe('clear', () => {
    test('removes all entries', () => {
      const store = new MemoryStore();
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      store.clear();
      assert.equal(store.size(), 0);
      assert.equal(store.get('a'), undefined);
    });
  });

  describe('mget/mset', () => {
    test('mset stores multiple values', () => {
      const store = new MemoryStore();
      const entries = new Map([['a', 1], ['b', 2], ['c', 3]]);
      store.mset(entries);
      assert.equal(store.get('a'), 1);
      assert.equal(store.get('b'), 2);
      assert.equal(store.get('c'), 3);
    });

    test('mget retrieves multiple values', () => {
      const store = new MemoryStore();
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
      const result = store.mget(['a', 'b', 'd']);
      assert.equal(result.get('a'), 1);
      assert.equal(result.get('b'), 2);
      assert.equal(result.has('d'), false);
    });
  });

  describe('keys', () => {
    test('returns all keys', () => {
      const store = new MemoryStore();
      store.set('x', 1);
      store.set('y', 2);
      store.set('z', 3);
      const keys = store.keys();
      assert.deepEqual(keys.sort(), ['x', 'y', 'z']);
    });
  });

  describe('cleanup', () => {
    test('removes expired entries', async () => {
      const store = new MemoryStore({ ttl: 50 });
      store.set('a', 1);
      store.set('b', 2, 0);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const removed = store.cleanup();
      assert.equal(removed, 1);
      assert.equal(store.has('a'), false);
      assert.equal(store.has('b'), true);
    });

    test('returns 0 when nothing to clean', () => {
      const store = new MemoryStore({ ttl: 0 });
      store.set('a', 1);
      assert.equal(store.cleanup(), 0);
    });
  });

  describe('size', () => {
    test('tracks entry count', () => {
      const store = new MemoryStore();
      assert.equal(store.size(), 0);
      store.set('a', 1);
      assert.equal(store.size(), 1);
      store.set('b', 2);
      assert.equal(store.size(), 2);
      store.del('a');
      assert.equal(store.size(), 1);
    });
  });
});
