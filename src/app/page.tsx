'use client';

import { useEffect, useState } from 'react';
import { ZkLoginClient, type ZkLoginState, ZkLoginError } from '../../lib';

const STEPS = [
  'Initialize',
  'Generate Key Pair',
  'OAuth Login',
  'Decode JWT',
  'Generate Salt',
  'Generate Address',
  'Get ZK Proof',
  'Ready to Transact'
];

export default function Home() {
  const [client, setClient] = useState<ZkLoginClient | null>(null);
  const [state, setState] = useState<ZkLoginState | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [txDigest, setTxDigest] = useState<string>('');

  // Initialize client
  useEffect(() => {
    try {
      const zkClient = new ZkLoginClient({
        clientId: '448930399523-4quflt6udj3esmgcgcjpvbecda67d5oh.apps.googleusercontent.com',
        redirectUri: typeof window !== 'undefined' ? window.location.origin + '/' : '',
        network: 'https://rpc-testnet.onelabs.cc:443',
        debug: true,
      });

      // Listen to events
      zkClient.on('step:changed', (step) => {
        setState(zkClient.getState());
        console.log('****************************** step => ' + step)
        // setSuccessMessage(`Step ${step} completed!`);
        // setTimeout(() => setSuccessMessage(''), 3000);
      });

      zkClient.on('error', (errorMsg) => {
        setError(errorMsg);
        setTimeout(() => setError(''), 5000);
      });

      zkClient.on('ready', () => {
        console.log('****************************** ZkLogin is ready!')
        setSuccessMessage('ZkLogin is ready! You can now execute transactions.');
        debugger;
        window.location.href = '/'
      });

      setClient(zkClient);
      setState(zkClient.getState());

      // Handle OAuth callback
      if (typeof window !== 'undefined' && window.location.hash) {
        try {
          zkClient.handleOAuthCallback();
        } catch (err) {
          console.error('OAuth callback error:', err);
        }
      }
    } catch (err) {
      setError(`Failed to initialize client: ${err}`);
    }
  }, []);

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    if (!client) return;

    setLoading(prev => ({ ...prev, [action]: true }));
    setError('');

    try {
      await fn();
    } catch (err) {
      if (err instanceof ZkLoginError) {
        setError(`${err.message} (Step ${err.step})`);
      } else {
        setError(`${action} failed: ${err}`);
      }
    } finally {
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Copied to clipboard!');
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  const getProgressPercentage = () => {
    if (!state) return 0;
    return Math.max(0, (state.currentStep / (STEPS.length - 1)) * 100);
  };

  const [isShow] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        {isShow && (
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              ZkLogin Plus Demo
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              A powerful zkLogin plugin for Sui blockchain - inspired by @mysten/enoki
            </p>
            <div className="inline-flex items-center space-x-4 bg-white p-4 rounded-lg shadow-md">
              <span className="text-sm font-medium text-gray-700">GitHub:</span>
              <a
                href="https://github.com/your-org/zklogin-plus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                @mysten/zklogin-plus
              </a>
            </div>
          </div>
        )}

        {/* Progress */}
        {isShow && state && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Progress</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                state.isReady
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                Step {state.currentStep} of {STEPS.length - 1}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Current: {STEPS[state.currentStep] || 'Unknown'}
            </p>
          </div>
        )}

        {/* Alerts */}
        {isShow && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isShow && successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-green-400">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          {/* Step 1: Generate Ephemeral Key Pair */}
          {isShow && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 1: Generate Ephemeral Key Pair
              </h3>
              <p className="text-gray-600 mb-4">
                Generate a temporary key pair for signing transactions
              </p>

              <button
                onClick={() => handleAction('generateKeyPair', () => client!.generateEphemeralKeyPair())}
                disabled={loading.generateKeyPair || (state?.ephemeralKeyPair !== undefined)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors mb-4 ${
                  loading.generateKeyPair || (state?.ephemeralKeyPair !== undefined)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading.generateKeyPair ? '⏳ Generating...' : 'Generate Key Pair'}
              </button>

              {state?.ephemeralKeyPair && (
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Max Epoch:</p>
                    <p className="text-sm font-mono text-gray-900">{state.ephemeralKeyPair.maxEpoch}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Randomness:</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{state.ephemeralKeyPair.randomness}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: OAuth Login */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Step 2: OAuth Login
            </h3>
            <p className="text-gray-600 mb-4">
              Login with Google to get a JWT token
            </p>

            <button
              onClick={() => handleAction('oauth', () => {
                client!.redirectToOAuth('google');
                return Promise.resolve();
              })}
              disabled={!state?.ephemeralKeyPair || state?.jwt !== undefined}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !state?.ephemeralKeyPair || state?.jwt !== undefined
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              🔗 Login with Google
            </button>

            {state?.jwt && (
              <div className="mt-4 bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">JWT Status:</p>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  state.jwt.isValid
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {state.jwt.isValid ? 'Valid' : 'Expired'}
                </span>
                <p className="text-sm text-gray-600 mt-2">
                  Subject: {state.jwt.payload.sub}
                </p>
              </div>
            )}
          </div>

          {/* Step 3: Generate Salt */}
          {isShow && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 3: Generate User Salt
              </h3>
              <p className="text-gray-600 mb-4">
                Generate a unique salt for address generation
              </p>

              <button
                onClick={() => handleAction('generateSalt', () => {
                  client!.generateSalt();
                  return Promise.resolve();
                })}
                disabled={loading.generateSalt || !state?.jwt || state?.userSalt !== undefined}
                className={`px-4 py-2 rounded-lg font-medium transition-colors mb-4 ${
                  loading.generateSalt || !state?.jwt || state?.userSalt !== undefined
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {loading.generateSalt ? '⏳ Generating...' : 'Generate Salt'}
              </button>

              {state?.userSalt && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">User Salt:</p>
                  <p className="text-sm font-mono text-gray-900 break-all">{JSON.stringify(state.userSalt.salt)}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Generate Address */}
          {isShow && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 4: Generate ZkLogin Address
              </h3>
              <p className="text-gray-600 mb-4">
                Generate your Sui address from JWT and salt
              </p>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => handleAction('generateAddress', () => client!.generateAddress())}
                  disabled={loading.generateAddress || !state?.userSalt || state?.zkLoginAddress !== undefined}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    loading.generateAddress || !state?.userSalt || state?.zkLoginAddress !== undefined
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {loading.generateAddress ? '⏳ Generating...' : 'Generate Address'}
                </button>

                {state?.zkLoginAddress && (
                  <button
                    onClick={() => handleAction('requestTokens', () => client!.requestTestTokens())}
                    disabled={loading.requestTokens}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      loading.requestTokens
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-yellow-600 text-white hover:bg-yellow-700'
                    }`}
                  >
                    {loading.requestTokens ? '⏳ Requesting...' : '💰 Request Test Tokens'}
                  </button>
                )}
              </div>

              {state?.zkLoginAddress && (
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700">Address:</p>
                      <button
                        onClick={() => copyToClipboard(state.zkLoginAddress!.address)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <p className="text-sm font-mono text-gray-900 break-all">{state.zkLoginAddress.address}</p>
                  </div>

                  {state.zkLoginAddress.balance && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1">Balance:</p>
                      <p className="text-sm text-gray-900">{(Number(state.zkLoginAddress.balance) / 1e9).toFixed(6)} OCT</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Get ZK Proof */}
          {isShow && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Step 5: Get ZK Proof
              </h3>
              <p className="text-gray-600 mb-4">
                Request zero-knowledge proof for transaction signing
              </p>

              <button
                onClick={() => handleAction('getZkProof', () => client!.getZkProof())}
                disabled={loading.getZkProof || !state?.zkLoginAddress || state?.zkProof !== undefined}
                className={`px-4 py-2 rounded-lg font-medium transition-colors mb-4 ${
                  loading.getZkProof || !state?.zkLoginAddress || state?.zkProof !== undefined
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading.getZkProof ? '⏳ Requesting...' : '🔐 Get ZK Proof'}
              </button>

              {state?.zkProof && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">ZK Proof:</p>
                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                  ✅ Received
                </span>
                  <p className="text-xs text-gray-500 mt-2">
                    Proof contains cryptographic data for transaction verification
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Execute Transaction */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Step 6: Execute Transaction
            </h3>
            <p className="text-gray-600 mb-4">
              Execute a test transaction using zkLogin signature
            </p>
            {state?.zkLoginAddress && (
              <p className="text-sm font-mono text-gray-900 break-all">{state.zkLoginAddress.address}</p>
            )}

            <button
              onClick={() => handleAction('executeTransaction', async () => {
                const digest = await client!.executeTransaction();
                setTxDigest(digest);
                return digest;
              })}
              disabled={loading.executeTransaction || !state?.isReady}
              className={`px-4 py-2 rounded-lg font-medium transition-colors mb-4 ${
                loading.executeTransaction || !state?.isReady
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {loading.executeTransaction ? '⏳ Executing...' : '🚀 Execute Test Transaction'}
            </button>

            {txDigest && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-700">Transaction Digest:</p>
                  <button
                    onClick={() => copyToClipboard(txDigest)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className="text-sm font-mono text-gray-900 break-all mb-3">{txDigest}</p>
                <button
                  onClick={() => window.open(`https://onescan.cc/testnet/transactionBlocksDetail?digest=${txDigest}`, '_blank')}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  🔗 View on Explorer
                </button>
              </div>
            )}
          </div>

          {/* Reset */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Reset
            </h3>
            <p className="text-gray-600 mb-4">
              Clear all stored data and start over
            </p>

            <button
              onClick={() => {
                client?.reset();
                setState(client?.getState() || null);
                setTxDigest('');
                setError('');
                setSuccessMessage('');
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              🗑️ Reset All Data
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 py-8 border-t border-gray-200">
          <p className="text-gray-600 mb-4">
            Made with ❤️ by the ZkLogin Plus team
          </p>
          <div className="flex justify-center space-x-6 text-sm">
            <a href="https://docs.sui.io/concepts/cryptography/zklogin" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
              Sui zkLogin Docs
            </a>
            <a href="https://github.com/your-org/zklogin-plus" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/@mysten/zklogin-plus" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
              npm Package
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
