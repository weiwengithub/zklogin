# ZkLogin Plus

A powerful zkLogin plugin for Sui blockchain - inspired by @mysten/enoki

## Features

- 🔐 **Complete zkLogin Workflow**: 7-step process from key generation to transaction execution
- 🎯 **Simple API**: Easy-to-use TypeScript client with event-driven architecture
- 🏪 **Multiple Storage Options**: Browser localStorage, sessionStorage, or custom storage
- 🌐 **OAuth Integration**: Support for Google, Facebook, Twitch, Apple, and custom providers
- 📱 **Framework Agnostic**: Works with React, Vue, vanilla JS, or any frontend framework
- 🔧 **Developer Friendly**: Full TypeScript support with comprehensive error handling
- 🎨 **Demo App**: Complete demo application showcasing all features

## Quick Start

### Installation

```bash
npm install @mysten/zklogin-plus
# or
yarn add @mysten/zklogin-plus
# or
bun add @mysten/zklogin-plus
```

### Basic Usage

```typescript
import { ZkLoginClient } from '@mysten/zklogin-plus';

// Initialize the client
const client = new ZkLoginClient({
  clientId: 'your-oauth-client-id',
  redirectUri: 'https://your-app.com/callback',
  network: 'devnet', // or 'testnet', 'mainnet'
});

// Listen to events
client.on('ready', () => {
  console.log('ZkLogin is ready for transactions!');
});

client.on('error', (error) => {
  console.error('ZkLogin error:', error);
});

// Step 1: Generate ephemeral key pair
await client.generateEphemeralKeyPair();

// Step 2: Redirect to OAuth (Google)
client.redirectToOAuth('google');

// Step 3: Handle OAuth callback (in your callback page)
client.handleOAuthCallback();

// Step 4: Generate user salt
client.generateSalt();

// Step 5: Generate zkLogin address
await client.generateAddress();

// Step 6: Get ZK proof
await client.getZkProof();

// Step 7: Execute transaction
const txDigest = await client.executeTransaction({
  recipient: '0x...',
  amount: 1000000000n, // 1 SUI in MIST
});
```

## Configuration

```typescript
interface ZkLoginConfig {
  /** OAuth client ID */
  clientId: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** Sui network */
  network?: 'mainnet' | 'testnet' | 'devnet' | string;
  /** ZK proof service endpoint */
  proverEndpoint?: string;
  /** Faucet endpoint for test tokens */
  faucetEndpoint?: string;
  /** Storage key prefix */
  storagePrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}
```

## API Reference

### ZkLoginClient

#### Methods

- `generateEphemeralKeyPair(): Promise<EphemeralKeyPairState>`
- `redirectToOAuth(provider: ZkLoginProvider, state?: string): void`
- `handleOAuthCallback(url?: string): JwtState`
- `generateSalt(): UserSaltState`
- `generateAddress(): Promise<ZkLoginAddressState>`
- `getZkProof(): Promise<ZkProofData>`
- `executeTransaction(options?: TransactionOptions): Promise<string>`
- `requestTestTokens(): Promise<void>`
- `refreshBalance(): Promise<string>`
- `reset(): void`
- `getState(): ZkLoginState`

#### Events

- `step:changed`: Fired when workflow step changes
- `keypair:generated`: Fired when ephemeral key pair is generated
- `jwt:received`: Fired when JWT is received from OAuth
- `salt:generated`: Fired when user salt is generated
- `address:generated`: Fired when zkLogin address is generated
- `proof:received`: Fired when ZK proof is received
- `error`: Fired when an error occurs
- `ready`: Fired when all steps are complete and ready for transactions

### Utilities

```typescript
import {
  generateEphemeralKeyPair,
  decodeJwtToken,
  generateUserSalt,
  generateZkLoginAddress,
  requestZkProof,
  buildZkLoginSignature,
  // ... more utilities
} from '@mysten/zklogin-plus';
```

## React Example

```typescript
import { useEffect, useState } from 'react';
import { ZkLoginClient, type ZkLoginState } from '@mysten/zklogin-plus';

function MyComponent() {
  const [client] = useState(() => new ZkLoginClient({
    clientId: 'your-client-id',
    redirectUri: window.location.origin,
    network: 'devnet',
  }));

  const [state, setState] = useState<ZkLoginState>();

  useEffect(() => {
    const handleStateChange = () => setState(client.getState());

    client.on('step:changed', handleStateChange);
    client.on('ready', handleStateChange);
    client.on('error', (error) => console.error(error));

    setState(client.getState());

    return () => {
      client.off('step:changed', handleStateChange);
      client.off('ready', handleStateChange);
    };
  }, [client]);

  return (
    <div>
      <h1>Current Step: {state?.currentStep}</h1>
      <button onClick={() => client.generateEphemeralKeyPair()}>
        Generate Key Pair
      </button>
      {/* ... more UI */}
    </div>
  );
}
```

## Storage Options

```typescript
import {
  BrowserStorage,
  BrowserSessionStorage,
  MemoryStorage
} from '@mysten/zklogin-plus';

// Custom storage implementation
class CustomStorage implements Storage {
  get(key: string): string | null { /* ... */ }
  set(key: string, value: string): void { /* ... */ }
  remove(key: string): void { /* ... */ }
  clear(): void { /* ... */ }
}
```

## Error Handling

```typescript
import { ZkLoginError } from '@mysten/zklogin-plus';

try {
  await client.generateEphemeralKeyPair();
} catch (error) {
  if (error instanceof ZkLoginError) {
    console.log('Error code:', error.code);
    console.log('Error step:', error.step);
    console.log('Error message:', error.message);
  }
}
```

## Demo Application

Run the demo application to see all features in action:

```bash
git clone https://github.com/your-org/zklogin-plus.git
cd zklogin-plus
bun install
bun run demo
```

The demo will be available at `http://localhost:3000`

## Development

### Building the Library

```bash
# Build the library
bun run build:lib

# Run demo application
bun run demo

# Run linting
bun run lint

# Format code
bun run format
```

### Project Structure

```
zklogin-plus/
├── lib/                 # Library source code
│   ├── client/         # Main ZkLoginClient
│   ├── types/          # TypeScript definitions
│   ├── utils/          # Utility functions
│   ├── storage/        # Storage implementations
│   ├── providers/      # OAuth providers
│   └── index.ts        # Main entry point
├── src/                # Demo application
└── dist/               # Built library (generated)
```

## Comparison with @mysten/enoki

| Feature | ZkLogin Plus | @mysten/enoki |
|---------|--------------|---------------|
| zkLogin Support | ✅ Full workflow | ✅ Basic support |
| OAuth Providers | ✅ Multiple providers | ✅ Limited |
| Storage Options | ✅ Flexible storage | ❌ Limited |
| Event System | ✅ Comprehensive | ❌ Basic |
| TypeScript | ✅ Full support | ✅ Full support |
| Demo App | ✅ Complete demo | ❌ No demo |
| Framework Support | ✅ Framework agnostic | ✅ React focused |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache-2.0 License - see [LICENSE](LICENSE) for details.

## Support

- 📖 [Documentation](https://zklogin-plus.docs.com)
- 🐛 [Issue Tracker](https://github.com/your-org/zklogin-plus/issues)
- 💬 [Discord Community](https://discord.gg/zklogin-plus)

---

Made with ❤️ by the ZkLogin Plus team
