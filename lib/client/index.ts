import { SuiClient } from '@onelabs/sui/client';
import { Transaction } from '@onelabs/sui/transactions';
import { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import { PublicKey } from '@onelabs/sui/cryptography';
import { MIST_PER_SUI } from '@onelabs/sui/utils';

import type {
  ZkLoginConfig,
  ZkLoginState,
  ZkLoginEvents,
  EphemeralKeyPairState,
  JwtState,
  UserSaltState,
  ZkLoginAddressState,
  ZkProofData,
  Storage,
  ZkLoginProvider,
  TransactionOptions,
} from '../types';

import {
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
  validateConfig,
  ZkLoginError,
} from '../utils';

import { BrowserStorage, BrowserSessionStorage, STORAGE_KEYS } from '../storage';
import { createOAuthProvider, parseOAuthCallback, validateOAuthCallback } from '../providers';

/**
 * 事件发射器
 */
class EventEmitter<T extends Record<string, (...args: unknown[]) => void>> {
  private listeners: { [K in keyof T]?: T[K][] } = {};

  on<K extends keyof T>(event: K, listener: T[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof T>(event: K, listener: T[K]): void {
    if (!this.listeners[event]) return;
    const index = this.listeners[event]!.indexOf(listener);
    if (index > -1) {
      this.listeners[event]!.splice(index, 1);
    }
  }

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    });
  }
}

/**
 * ZkLogin客户端
 */
export class ZkLoginClient extends EventEmitter<ZkLoginEvents> {
  private config: Required<ZkLoginConfig>;
  private suiClient: SuiClient;
  private storage: Storage;
  private sessionStorage: Storage;
  private state: ZkLoginState;

  constructor(config: ZkLoginConfig) {
    super();

    validateConfig(config);

    this.config = {
      network: 'devnet',
      proverEndpoint: DEFAULT_CONFIG.proverEndpoint,
      faucetEndpoint: DEFAULT_CONFIG.faucetEndpoint,
      storagePrefix: DEFAULT_CONFIG.storagePrefix,
      getSaltUrl: DEFAULT_CONFIG.getSaltUrl,
      debug: false,
      ...config,
    };
    // 初始化Sui客户端
    const networkUrl = typeof this.config.network === 'string' && this.config.network in NETWORK_URLS
      ? NETWORK_URLS[this.config.network as keyof typeof NETWORK_URLS]
      : this.config.network;

    this.suiClient = new SuiClient({ url: networkUrl });

    // 初始化存储
    this.storage = new BrowserStorage(this.config.storagePrefix);
    this.sessionStorage = new BrowserSessionStorage(this.config.storagePrefix);

    // 初始化状态
    this.state = {
      currentStep: 0,
      isReady: false,
    };

    // 从存储中恢复状态
    this.restoreState();
  }

  /**
   * 获取当前状态
   */
  getState(): ZkLoginState {
    return { ...this.state };
  }

  /**
   * 获取配置
   */
  getConfig(): Required<ZkLoginConfig> {
    return { ...this.config };
  }

  /**
   * 获取Sui客户端
   */
  getSuiClient(): SuiClient {
    return this.suiClient;
  }

  /**
   * 步骤1: 生成临时密钥对
   */
  async generateEphemeralKeyPair(): Promise<EphemeralKeyPairState> {
    try {
      this.debug('Generating ephemeral key pair...');

      // 获取当前epoch
      const currentEpoch = await getCurrentEpoch(this.suiClient);
      const maxEpoch = calculateMaxEpoch(currentEpoch);

      // 生成密钥对
      const keyPairState = generateEphemeralKeyPair(maxEpoch);

      // 保存到session storage
      this.sessionStorage.set(STORAGE_KEYS.EPHEMERAL_KEYPAIR,
        keyPairState.keyPair.getSecretKey());
      this.sessionStorage.set(STORAGE_KEYS.MAX_EPOCH, maxEpoch.toString());
      this.sessionStorage.set(STORAGE_KEYS.RANDOMNESS, keyPairState.randomness);

      // 更新状态
      this.state.ephemeralKeyPair = keyPairState;
      this.state.currentStep = Math.max(this.state.currentStep, 1);

      this.emit('keypair:generated', keyPairState);
      this.emit('step:changed', this.state.currentStep);

      return keyPairState;
    } catch (error) {
      const errorMsg = `Failed to generate ephemeral key pair: ${error}`;
      this.handleError(errorMsg, 1);
      throw new ZkLoginError(errorMsg, 'KEYPAIR_GENERATION_FAILED', 1);
    }
  }

  /**
   * 步骤2: 重定向到OAuth提供商
   */
  redirectToOAuth(provider: ZkLoginProvider = 'google', state?: string): void {
    try {
      if (!this.state.ephemeralKeyPair) {
        throw new Error('Ephemeral key pair not generated yet');
      }

      this.debug(`Redirecting to OAuth provider: ${provider}`);

      const oauthProvider = createOAuthProvider(
        provider,
        this.config.clientId,
        this.config.redirectUri
      );

      oauthProvider.redirect(this.state.ephemeralKeyPair.nonce, state);
    } catch (error) {
      const errorMsg = `Failed to redirect to OAuth: ${error}`;
      this.handleError(errorMsg, 2);
      throw new ZkLoginError(errorMsg, 'OAUTH_REDIRECT_FAILED', 2);
    }
  }

  /**
   * 步骤3: 处理OAuth回调并解码JWT
   */
  handleOAuthCallback(url?: string): JwtState {
    try {
      this.debug('Handling OAuth callback...');

      const params = parseOAuthCallback(url);
      validateOAuthCallback(params);

      const jwtState = decodeJwtToken(params.id_token!);

      // 保存JWT到session storage
      this.sessionStorage.set(STORAGE_KEYS.JWT_TOKEN, params.id_token!);

      // 更新状态
      this.state.jwt = jwtState;
      this.state.currentStep = Math.max(this.state.currentStep, 3);

      this.emit('jwt:received', jwtState);
      this.emit('step:changed', this.state.currentStep);

      this.generateSalt()
      return jwtState;
    } catch (error) {
      const errorMsg = `Failed to handle OAuth callback: ${error}`;
      this.handleError(errorMsg, 3);
      throw new ZkLoginError(errorMsg, 'OAUTH_CALLBACK_FAILED', 3);
    }
  }

  /**
   * 步骤4: 生成用户Salt
   */
  async generateSalt(): Promise<UserSaltState> {
    try {
      this.debug('Generating user salt...');

      const jwtToken = this.sessionStorage.get(STORAGE_KEYS.JWT_TOKEN) as string;
      const salt = await generateUserSalt(this.config.getSaltUrl, jwtToken);

      const saltState: UserSaltState = {
        salt,
        createdAt: Date.now(),
      };

      // 保存到localStorage
      this.storage.set(STORAGE_KEYS.USER_SALT, JSON.stringify(saltState));

      // 更新状态
      this.state.userSalt = saltState;
      this.state.currentStep = Math.max(this.state.currentStep, 4);

      this.emit('salt:generated', saltState);
      this.emit('step:changed', this.state.currentStep);

      this.generateAddress()
      return saltState;
    } catch (error) {
      const errorMsg = `Failed to generate salt: ${error}`;
      this.handleError(errorMsg, 4);
      throw new ZkLoginError(errorMsg, 'SALT_GENERATION_FAILED', 4);
    }
  }

  /**
   * 步骤5: 生成ZkLogin地址
   */
  async generateAddress(): Promise<ZkLoginAddressState> {
    try {
      if (!this.state.jwt) {
        throw new Error('JWT not available');
      }
      if (!this.state.userSalt) {
        throw new Error('User salt not generated');
      }

      this.debug('Generating zkLogin address...');

      const addressState = generateZkLoginAddress(
        this.state.jwt.token,
        this.state.userSalt.salt
      );

      // 获取余额
      addressState.balance = await getAddressBalance(this.suiClient, addressState.address);

      // 保存到localStorage
      this.storage.set(STORAGE_KEYS.ZKLOGIN_ADDRESS, JSON.stringify(addressState));

      // 更新状态
      this.state.zkLoginAddress = addressState;
      this.state.currentStep = Math.max(this.state.currentStep, 5);

      this.emit('address:generated', addressState);
      this.emit('step:changed', this.state.currentStep);

      this.getZkProof()
      return addressState;
    } catch (error) {
      const errorMsg = `Failed to generate address: ${error}`;
      this.handleError(errorMsg, 5);
      throw new ZkLoginError(errorMsg, 'ADDRESS_GENERATION_FAILED', 5);
    }
  }

  /**
   * 步骤6: 获取ZK证明
   */
  async getZkProof(): Promise<ZkProofData> {
    try {
      if (!this.state.ephemeralKeyPair) {
        throw new Error('Ephemeral key pair not available');
      }
      if (!this.state.jwt) {
        throw new Error('JWT not available');
      }
      if (!this.state.userSalt) {
        throw new Error('User salt not available');
      }

      this.debug('Requesting ZK proof...');

      const extendedPublicKey = getExtendedPublicKey(
        this.state.ephemeralKeyPair.keyPair.getPublicKey() as PublicKey
      );

      const zkProof = await requestZkProof(
        this.state.jwt.token,
        extendedPublicKey,
        this.state.ephemeralKeyPair.maxEpoch,
        this.state.ephemeralKeyPair.randomness,
        this.state.userSalt.salt,
        this.config.proverEndpoint
      );

      // 保存ZK证明
      this.sessionStorage.set(STORAGE_KEYS.ZK_PROOF, JSON.stringify(zkProof));

      // 更新状态
      this.state.zkProof = zkProof;
      this.state.currentStep = Math.max(this.state.currentStep, 6);
      this.state.isReady = true;

      this.emit('proof:received', zkProof);
      this.emit('step:changed', this.state.currentStep);
      this.emit('ready');

      return zkProof;
    } catch (error) {
      const errorMsg = `Failed to get ZK proof: ${error}`;
      this.handleError(errorMsg, 6);
      throw new ZkLoginError(errorMsg, 'ZK_PROOF_FAILED', 6);
    }
  }

  /**
   * 步骤7: 执行交易
   */
  async executeTransaction(options: TransactionOptions = {}): Promise<string> {
    try {
      if (!this.state.isReady) {
        throw new Error('ZkLogin not ready. Complete all steps first.');
      }

      this.debug('Executing transaction...');

      const { ephemeralKeyPair, zkProof, zkLoginAddress } = this.state;
      if (!ephemeralKeyPair || !zkProof || !zkLoginAddress) {
        throw new Error('Missing required state for transaction execution');
      }

      // 创建交易
      let txb = new Transaction();

      if (options.recipient && options.amount) {
        // 转账交易
        const [coin] = txb.splitCoins(txb.gas, [options.amount]);
        txb.transferObjects([coin], options.recipient);
      } else if (options.transactionData) {
        // 自定义交易数据
        // 这里可以根据需要扩展

        txb = options.transactionData;
      } else {
        // 默认交易：转账少量SUI给固定地址
        const [coin] = txb.splitCoins(txb.gas, [MIST_PER_SUI / 1n]);
        txb.transferObjects(
          [coin],
          "0x23bf8c3d7d2d55f8b78a72e3ee2d53a849c9db976ac5e8142e3ee12be4cf81d6"
        );
      }

      txb.setSender(zkLoginAddress.address);

      // 签名交易
      const { bytes, signature: userSignature } = await txb.sign({
        client: this.suiClient,
        signer: ephemeralKeyPair.keyPair,
      });

      // 构建zkLogin签名
      const zkLoginSignature = buildZkLoginSignature(
        zkProof,
        ephemeralKeyPair.maxEpoch,
        userSignature,
        zkLoginAddress.addressSeed
      );

      // 执行交易
      const executeRes = await this.suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
      });

      this.debug(`Transaction executed: ${executeRes.digest}`);
      return executeRes.digest;
    } catch (error) {
      const errorMsg = `Failed to execute transaction: ${error}`;
      this.handleError(errorMsg, 7);
      throw new ZkLoginError(errorMsg, 'TRANSACTION_EXECUTION_FAILED', 7);
    }
  }

  /**
   * 请求测试代币
   */
  async requestTestTokens(): Promise<void> {
    try {
      if (!this.state.zkLoginAddress) {
        throw new Error('ZkLogin address not generated');
      }

      this.debug('Requesting test tokens from faucet...');

      await requestFaucet(this.state.zkLoginAddress.address, this.config.faucetEndpoint);

      // 更新余额
      const balance = await getAddressBalance(this.suiClient, this.state.zkLoginAddress.address);
      this.state.zkLoginAddress.balance = balance;

      this.debug('Test tokens requested successfully');
    } catch (error) {
      const errorMsg = `Failed to request test tokens: ${error}`;
      this.handleError(errorMsg);
      throw new ZkLoginError(errorMsg, 'FAUCET_REQUEST_FAILED');
    }
  }

  /**
   * 刷新地址余额
   */
  async refreshBalance(): Promise<string> {
    if (!this.state.zkLoginAddress) {
      throw new Error('ZkLogin address not generated');
    }

    const balance = await getAddressBalance(this.suiClient, this.state.zkLoginAddress.address);
    this.state.zkLoginAddress.balance = balance;
    return balance;
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.debug('Resetting all state...');

    this.storage.clear();
    this.sessionStorage.clear();

    this.state = {
      currentStep: 0,
      isReady: false,
    };

    this.debug('State reset completed');
    this.generateEphemeralKeyPair()
  }

  /**
   * 从存储中恢复状态
   */
  private restoreState(): void {
    try {
      // 恢复ephemeral key pair
      const privateKey = this.sessionStorage.get(STORAGE_KEYS.EPHEMERAL_KEYPAIR);
      const maxEpochStr = this.sessionStorage.get(STORAGE_KEYS.MAX_EPOCH);
      const randomness = this.sessionStorage.get(STORAGE_KEYS.RANDOMNESS);

      if (privateKey && maxEpochStr && randomness) {
        const keyPair = Ed25519Keypair.fromSecretKey(privateKey);
        const maxEpoch = parseInt(maxEpochStr);

        this.state.ephemeralKeyPair = {
          keyPair,
          maxEpoch,
          randomness,
          nonce: '', // nonce会在需要时重新生成
        };
        this.state.currentStep = Math.max(this.state.currentStep, 1);
      } else {
        this.generateEphemeralKeyPair()
      }

      // 恢复JWT
      const jwtToken = this.sessionStorage.get(STORAGE_KEYS.JWT_TOKEN);
      if (jwtToken) {
        try {
          this.state.jwt = decodeJwtToken(jwtToken);
          this.state.currentStep = Math.max(this.state.currentStep, 3);
        } catch (error) {
          // JWT可能已过期，清除它
          this.sessionStorage.remove(STORAGE_KEYS.JWT_TOKEN);
        }
      }

      // 恢复用户salt
      const userSaltStr = this.storage.get(STORAGE_KEYS.USER_SALT);
      if (userSaltStr) {
        try {
          this.state.userSalt = JSON.parse(userSaltStr);
          this.state.currentStep = Math.max(this.state.currentStep, 4);
        } catch (error) {
          this.storage.remove(STORAGE_KEYS.USER_SALT);
        }
      }

      // 恢复zkLogin地址
      const addressStr = this.storage.get(STORAGE_KEYS.ZKLOGIN_ADDRESS);
      if (addressStr) {
        try {
          this.state.zkLoginAddress = JSON.parse(addressStr);
          this.state.currentStep = Math.max(this.state.currentStep, 5);
        } catch (error) {
          this.storage.remove(STORAGE_KEYS.ZKLOGIN_ADDRESS);
        }
      }

      // 恢复ZK证明
      const zkProofStr = this.sessionStorage.get(STORAGE_KEYS.ZK_PROOF);
      if (zkProofStr) {
        try {
          this.state.zkProof = JSON.parse(zkProofStr);
          this.state.currentStep = Math.max(this.state.currentStep, 6);
          this.state.isReady = true;
        } catch (error) {
          this.sessionStorage.remove(STORAGE_KEYS.ZK_PROOF);
        }
      }

      this.debug(`State restored. Current step: ${this.state.currentStep}`);
    } catch (error) {
      this.debug(`Failed to restore state: ${error}`);
    }
  }

  /**
   * 错误处理
   */
  private handleError(message: string, step?: number): void {
    this.state.error = message;
    if (step !== undefined) {
      this.state.currentStep = step;
    }

    this.emit('error', message);
    this.debug(`Error: ${message}`);
  }

  /**
   * 调试日志
   */
  private debug(message: string): void {
    if (this.config.debug) {
      console.log(`[ZkLoginClient] ${message}`);
    }
  }
}
