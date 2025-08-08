import type { Storage } from '../types';

/**
 * 浏览器localStorage存储实现
 */
export class BrowserStorage implements Storage {
  private prefix: string;

  constructor(prefix = 'zklogin_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.getKey(key));
  }

  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.getKey(key), value);
  }

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.getKey(key));
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}

/**
 * 浏览器sessionStorage存储实现
 */
export class BrowserSessionStorage implements Storage {
  private prefix: string;

  constructor(prefix = 'zklogin_session_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  get(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.getKey(key));
  }

  set(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(this.getKey(key), value);
  }

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(this.getKey(key));
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

/**
 * 内存存储实现(用于测试或服务端)
 */
export class MemoryStorage implements Storage {
  private storage = new Map<string, string>();
  private prefix: string;

  constructor(prefix = 'zklogin_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  get(key: string): string | null {
    return this.storage.get(this.getKey(key)) || null;
  }

  set(key: string, value: string): void {
    this.storage.set(this.getKey(key), value);
  }

  remove(key: string): void {
    this.storage.delete(this.getKey(key));
  }

  clear(): void {
    const keys = Array.from(this.storage.keys());
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        this.storage.delete(key);
      }
    });
  }
}

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
  EPHEMERAL_KEYPAIR: 'ephemeral_keypair',
  MAX_EPOCH: 'max_epoch',
  RANDOMNESS: 'randomness',
  USER_SALT: 'user_salt',
  JWT_TOKEN: 'jwt_token',
  ZKLOGIN_ADDRESS: 'zklogin_address',
  ZK_PROOF: 'zk_proof',
} as const;
