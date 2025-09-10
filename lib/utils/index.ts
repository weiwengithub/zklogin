import { SuiClient } from '@onelabs/sui/client';
import { Ed25519Keypair } from '@onelabs/sui/keypairs/ed25519';
import {
  generateNonce,
  generateRandomness,
  jwtToAddress,
  getExtendedEphemeralPublicKey,
  genAddressSeed,
  getZkLoginSignature
} from '@onelabs/sui/zklogin';
import { PublicKey } from '@onelabs/sui/cryptography';
import { jwtDecode, type JwtPayload } from 'jwt-decode';
import axios from 'axios';
import type { ZkProofData, EphemeralKeyPairState, JwtState, ZkLoginAddressState, ZkLoginConfig } from '../types';

/**
 * 网络URL映射
 */
export const NETWORK_URLS = {
  mainnet: 'https://rpc-mainnet.onelabs.cc:443',
  testnet: 'https://rpc-testnet.onelabs.cc:443',
  devnet: 'https://rpc-testnet.onelabs.cc:443',
} as const;

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  // proverEndpoint: 'https://prover-dev.mystenlabs.com/v1',
  proverEndpoint: 'https://zkprover.deltax.online/v1',
  faucetEndpoint: 'https://faucet-testnet.onelabs.cc/gas',
  storagePrefix: 'zklogin_plus_',
  getSaltUrl: 'https://salt.deltax.online/api/userSalt/Google',
} as const;

/**
 * 生成临时密钥对
 */
export function generateEphemeralKeyPair(maxEpoch: number): EphemeralKeyPairState {
  const keyPair = Ed25519Keypair.generate();
  const randomness = generateRandomness();
  const nonce = generateNonce(
    keyPair.getPublicKey() as PublicKey,
    maxEpoch,
    randomness
  );

  return {
    keyPair,
    maxEpoch,
    randomness,
    nonce,
  };
}

/**
 * 解码JWT令牌
 */
export function decodeJwtToken(token: string): JwtState {
  try {
    const payload = jwtDecode<JwtPayload>(token);
    const isValid = payload.exp ? Date.now() / 1000 < payload.exp : false;
    const expiresAt = payload.exp ? payload.exp * 1000 : 0;

    return {
      token,
      payload,
      isValid,
      expiresAt,
    };
  } catch (error) {
    throw new Error(`Invalid JWT token: ${error}`);
  }
}

/**
 * 生成用户Salt
 */
export async function generateUserSalt(getSaltUrl: string, id_token: string): Promise<string> {
  const {data:{data:{salt}}}= await axios.post(getSaltUrl, {
    jwt: id_token,
  });
  return salt as string;
}

/**
 * 生成ZkLogin地址
 */
export function generateZkLoginAddress(
  jwt: string,
  userSalt: string
): ZkLoginAddressState {
  try {
    const address = jwtToAddress(jwt, userSalt);
    const payload = jwtDecode<JwtPayload>(jwt);

    if (!payload.sub || !payload.aud) {
      throw new Error('JWT missing required claims (sub, aud)');
    }

    const addressSeed = genAddressSeed(
      BigInt(userSalt),
      'sub',
      payload.sub,
      Array.isArray(payload.aud) ? payload.aud[0] : payload.aud
    ).toString();

    return {
      address,
      addressSeed,
    };
  } catch (error) {
    throw new Error(`Failed to generate zkLogin address: ${error}`);
  }
}

/**
 * 获取扩展的临时公钥
 */
export function getExtendedPublicKey(publicKey: PublicKey): string {
  return getExtendedEphemeralPublicKey(publicKey);
}

/**
 * 请求ZK证明
 */
export async function requestZkProof(
  jwt: string,
  extendedEphemeralPublicKey: string,
  maxEpoch: number,
  randomness: string,
  userSalt: string,
  proverEndpoint: string
): Promise<ZkProofData> {
  try {
    const response = await axios.post(
      proverEndpoint,
      {
        jwt,
        extendedEphemeralPublicKey,
        maxEpoch,
        jwtRandomness: randomness,
        salt: userSalt,
        keyClaimName: 'sub',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30秒超时
      }
    );

    return response.data as ZkProofData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `ZK proof request failed: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}

/**
 * 生成zkLogin签名
 */
export function buildZkLoginSignature(
  zkProof: ZkProofData,
  maxEpoch: number,
  userSignature: string,
  addressSeed: string
): string {
  return getZkLoginSignature({
    inputs: {
      ...zkProof,
      addressSeed,
    },
    maxEpoch,
    userSignature,
  });
}

/**
 * 获取当前epoch
 */
export async function getCurrentEpoch(suiClient: SuiClient): Promise<number> {
  const systemState = await suiClient.getLatestSuiSystemState();
  return Number(systemState.epoch);
}

/**
 * 计算最大epoch(当前epoch + 10)
 */
export function calculateMaxEpoch(currentEpoch: number): number {
  return currentEpoch + 10;
}

/**
 * 获取地址余额
 */
export async function getAddressBalance(
  suiClient: SuiClient,
  address: string
): Promise<string> {
  try {
    const balance = await suiClient.getBalance({ owner: address });
    return balance.totalBalance;
  } catch (error) {
    return '0';
  }
}

/**
 * 请求水龙头
 */
export async function requestFaucet(
  address: string,
  faucetEndpoint: string
): Promise<void> {
  try {
    await axios.post(faucetEndpoint, {
      FixedAmountRequest: {
        recipient: address,
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Faucet request failed: ${error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}

/**
 * 构建OAuth URL
 */
export function buildOAuthUrl(
  provider: 'google' | 'facebook' | 'twitch' | 'apple',
  clientId: string,
  redirectUri: string,
  nonce: string,
  state?: string
): string {
  const baseUrls = {
    google: 'https://accounts.google.com/o/oauth2/v2/auth',
    facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    twitch: 'https://id.twitch.tv/oauth2/authorize',
    apple: 'https://appleid.apple.com/auth/authorize',
  };

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce,
  });

  if (state) {
    params.set('state', state);
  }

  return `${baseUrls[provider]}?${params.toString()}`;
}

/**
 * 验证配置
 */
export function validateConfig(config: Partial<ZkLoginConfig>): void {
  if (!config.clientId) {
    throw new Error('clientId is required');
  }
  if (!config.redirectUri) {
    throw new Error('redirectUri is required');
  }
}

/**
 * 错误处理工具
 */
export class ZkLoginError extends Error {
  constructor(
    message: string,
    public code?: string,
    public step?: number
  ) {
    super(message);
    this.name = 'ZkLoginError';
  }
}
