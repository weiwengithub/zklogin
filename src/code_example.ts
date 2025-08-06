import {OCT_PROVER_DEV_ENDPOINT} from "./constant.ts";

export const BUILD_ZKLOGIN_SIGNATURE = `const txb = new Transaction();

// Transfer 1 SUI to 0xfa0f...8a36.
const [coin] = txb.splitCoins(txb.gas,[MIST_PER_SUI * 1n]);
txb.transferObjects(
  [coin],
  "0x23bf8c3d7d2d55f8b78a72e3ee2d53a849c9db976ac5e8142e3ee12be4cf81d6"
);
txb.setSender(zkLoginUserAddress);

const { bytes, signature: userSignature } = await txb.sign({
  client,
  signer: ephemeralKeyPair
});

// Generate addressSeed using userSalt, sub, and aud (JWT Payload)
// as parameters for obtaining zkLoginSignature
const addressSeed: string = genAddressSeed(
  BigInt(userSalt),
  "sub",
  decodedJwt.sub,
  decodedJwt.aud
).toString();

// partialZkLoginSignature()
const zkLoginSignature: SerializedSignature = getZkLoginSignature({
  inputs: {
    ...partialZkLoginSignature,
    addressSeed,
  },
  maxEpoch,
  userSignature,
});

// Execute transaction
suiClient.executeTransactionBlock({
  transactionBlock: bytes,
  signature: zkLoginSignature,
});
`

export const AXIOS_ZKPROOF = `const zkProofResult = await axios.post(
  "${OCT_PROVER_DEV_ENDPOINT}",
  {
    jwt: oauthParams?.id_token as string,
    extendedEphemeralPublicKey: extendedEphemeralPublicKey,
    maxEpoch: maxEpoch,
    jwtRandomness: randomness,
    salt: userSalt,
    keyClaimName: "sub",
  },
  {
    headers: {
      "Content-Type": "application/json",
    },
  }
).data;

const partialZkLoginSignature = zkProofResult as PartialZkLoginSignature
`

export const GENERATE_NONCE = `import { generateNonce } from "@onechain/sui/zklogin";

 // Generate Nonce for acquiring JWT:
 const nonce = generateNonce(
   ephemeralKeyPair.getPublicKey(),
   maxEpoch,
   randomness
 );`
