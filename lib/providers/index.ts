import type { OAuthProviderConfig, ZkLoginProvider } from '../types';

/**
 * OAuth提供商配置
 */
export const OAUTH_PROVIDERS: Record<ZkLoginProvider, Partial<OAuthProviderConfig>> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scope: 'openid',
  },
  twitch: {
    authUrl: 'https://id.twitch.tv/oauth2/authorize',
    scope: 'openid',
  },
  apple: {
    authUrl: 'https://appleid.apple.com/auth/authorize',
    scope: 'openid',
  },
  custom: {
    authUrl: '',
    scope: 'openid',
  },
};

/**
 * OAuth提供商类
 */
export class OAuthProvider {
  private config: OAuthProviderConfig;

  constructor(
    private provider: ZkLoginProvider,
    clientId: string,
    redirectUri: string,
    customConfig?: Partial<OAuthProviderConfig>
  ) {
    const baseConfig = OAUTH_PROVIDERS[provider];

    this.config = {
      clientId,
      redirectUri,
      scope: 'openid',
      authUrl: '',
      ...baseConfig,
      ...customConfig,
    };

    if (!this.config.authUrl) {
      throw new Error(`Invalid provider: ${provider}`);
    }
  }

  /**
   * 构建认证URL
   */
  buildAuthUrl(nonce: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'id_token',
      scope: this.config.scope || 'openid',
      nonce,
    });

    if (state) {
      params.set('state', state);
    }

    // 为不同提供商添加特定参数
    switch (this.provider) {
      case 'apple':
        params.set('response_mode', 'form_post');
        break;
      case 'facebook':
        params.set('response_type', 'code id_token');
        break;
    }

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * 重定向到认证页面
   */
  redirect(nonce: string, state?: string): void {
    const authUrl = this.buildAuthUrl(nonce, state);
    window.location.href = authUrl;
  }

  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return this.provider;
  }

  /**
   * 获取配置
   */
  getConfig(): OAuthProviderConfig {
    return { ...this.config };
  }
}

/**
 * 创建提供商实例的工厂函数
 */
export function createOAuthProvider(
  provider: ZkLoginProvider,
  clientId: string,
  redirectUri: string,
  customConfig?: Partial<OAuthProviderConfig>
): OAuthProvider {
  return new OAuthProvider(provider, clientId, redirectUri, customConfig);
}

/**
 * 从URL中解析OAuth回调参数
 */
export function parseOAuthCallback(url?: string): {
  id_token?: string;
  access_token?: string;
  state?: string;
  error?: string;
} {
  const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  // 检查URL中的fragment(#)部分
  const hashParams = new URLSearchParams(targetUrl.split('#')[1] || '');

  // 检查URL中的query(?)部分
  const searchParams = new URLSearchParams(targetUrl.split('?')[1]?.split('#')[0] || '');

  return {
    id_token: hashParams.get('id_token') || searchParams.get('id_token') || undefined,
    access_token: hashParams.get('access_token') || searchParams.get('access_token') || undefined,
    state: hashParams.get('state') || searchParams.get('state') || undefined,
    error: hashParams.get('error') || searchParams.get('error') || undefined,
  };
}

/**
 * 验证OAuth回调
 */
export function validateOAuthCallback(params: ReturnType<typeof parseOAuthCallback>): void {
  if (params.error) {
    throw new Error(`OAuth error: ${params.error}`);
  }

  if (!params.id_token) {
    throw new Error('No id_token received from OAuth provider');
  }
}
