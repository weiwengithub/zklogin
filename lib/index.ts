/**
 * ZkLogin Plus - A powerful zkLogin plugin for Sui blockchain
 *
 * Inspired by @mysten/enoki, this plugin provides a complete
 * zkLogin workflow with enhanced developer experience.
 */

// Main client
export { ZkLoginClient } from './client';

// Types
export type {
  ZkLoginConfig,
  ZkLoginState,
  ZkLoginEvents,
  ZkLoginProvider,
  EphemeralKeyPairState,
  JwtState,
  UserSaltState,
  ZkLoginAddressState,
  ZkProofData,
  Storage,
  OAuthProviderConfig,
  TransactionOptions,
} from './types';

// Re-export for convenience
import type { ZkLoginConfig } from './types';
import { ZkLoginClient } from './client';

// Utilities
export {
  NETWORK_URLS,
  DEFAULT_CONFIG,
  generateEphemeralKeyPair,
  decodeJwtToken,
  generateUserSalt,
  generateZkLoginAddress,
  getExtendedPublicKey,
  requestZkProof,
  buildZkLoginSignature,
  getCurrentEpoch,
  calculateMaxEpoch,
  getAddressBalance,
  requestFaucet,
  buildOAuthUrl,
  validateConfig,
  ZkLoginError,
} from './utils';

// Storage
export {
  BrowserStorage,
  BrowserSessionStorage,
  MemoryStorage,
  STORAGE_KEYS,
} from './storage';

// Providers
export {
  OAUTH_PROVIDERS,
  OAuthProvider,
  createOAuthProvider,
  parseOAuthCallback,
  validateOAuthCallback,
} from './providers';

/**
 * 创建ZkLogin客户端的便捷函数
 */
export function createZkLoginClient(config: ZkLoginConfig) {
  return new ZkLoginClient(config);
}

/**
 * 版本信息
 */
export const VERSION = '1.0.0';

/**
 * 默认导出ZkLoginClient类
 */
export { ZkLoginClient as default };
