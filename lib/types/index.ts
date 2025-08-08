import type { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import type { PublicKey } from '@onelabs/sui/cryptography';
import type { JwtPayload } from 'jwt-decode';

/**
 * ZkLogin提供商类型
 */
export type ZkLoginProvider = 'google' | 'facebook' | 'twitch' | 'apple' | 'custom';

/**
 * ZkLogin配置选项
 */
export interface ZkLoginConfig {
  /** Sui网络URL */
  network?: 'mainnet' | 'testnet' | 'devnet' | string;
  /** OAuth客户端ID */
  clientId: string;
  /** OAuth重定向URI */
  redirectUri: string;
  /** ZK证明服务端点 */
  proverEndpoint?: string;
  /** 水龙头端点 */
  faucetEndpoint?: string;
  /** 存储前缀 */
  storagePrefix?: string;
  /** 盐服务端点 */
  getSaltUrl?: string;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 临时密钥对状态
 */
export interface EphemeralKeyPairState {
  keyPair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  nonce: string;
}

/**
 * JWT状态
 */
export interface JwtState {
  token: string;
  payload: JwtPayload;
  isValid: boolean;
  expiresAt: number;
}

/**
 * 用户Salt状态
 */
export interface UserSaltState {
  salt: string;
  createdAt: number;
}

/**
 * ZkLogin地址状态
 */
export interface ZkLoginAddressState {
  address: string;
  addressSeed: string;
  balance?: string;
}

/**
 * ZK证明数据
 */
export interface ZkProofData {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
  [key: string]: unknown;
}

/**
 * ZkLogin状态
 */
export interface ZkLoginState {
  currentStep: number;
  ephemeralKeyPair?: EphemeralKeyPairState;
  jwt?: JwtState;
  userSalt?: UserSaltState;
  zkLoginAddress?: ZkLoginAddressState;
  zkProof?: ZkProofData;
  isReady: boolean;
  error?: string;
}

/**
 * ZkLogin客户端事件
 */
export type ZkLoginEvents = {
  'step:changed': (step: number) => void;
  'keypair:generated': (keyPair: EphemeralKeyPairState) => void;
  'jwt:received': (jwt: JwtState) => void;
  'salt:generated': (salt: UserSaltState) => void;
  'address:generated': (address: ZkLoginAddressState) => void;
  'proof:received': (proof: ZkProofData) => void;
  'error': (error: string) => void;
  'ready': () => void;
} & Record<string, (...args: unknown[]) => void>;

/**
 * 存储接口
 */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

/**
 * OAuth提供商配置
 */
export interface OAuthProviderConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
  authUrl: string;
  tokenUrl?: string;
}

/**
 * 交易选项
 */
export interface TransactionOptions {
  /** 接收者地址 */
  recipient?: string;
  /** 转账金额(以MIST为单位) */
  amount?: bigint;
  /** 自定义交易数据 */
  transactionData?: unknown;
}
