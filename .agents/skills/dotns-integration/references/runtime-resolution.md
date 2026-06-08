---
quadrant: reference
---

# DotNS Runtime Resolution

## Purpose

Runtime DotNS resolution enables the Triangle Web Host (and compatible containers) to load products by `.dot` domain. This is SEPARATE from CLI/CI resolution — it runs in the browser.

---

## Dual-Chain Racing Architecture

The host resolves `.dot` domains by racing two resolver implementations via `Promise.any()`. First resolver to return wins.

| Resolver             | Chain           | Transport                   | Latency | Method                           |
| :------------------- | :-------------- | :-------------------------- | :------ | :------------------------------- |
| **EVM (viem)**       | Paseo Asset Hub | HTTP (`createPublicClient`) | ~100ms  | `readContract()` on EVM resolver |
| **Substrate (PAPI)** | Paseo Asset Hub | WebSocket (`getWsProvider`) | ~500ms  | `ReviveApi.call` dry run         |

---

## Resolution Flow

```
1. User enters "myapp.dot" in host
2. Host races both resolvers via Promise.any()
3. First resolver returns contenthash (hex-encoded bytes)
4. Host decodes contenthash:
   - Byte 0: 0xe3 (IPFS namespace)
   - Byte 1: 0x01 (codec marker)
   - Bytes 2+: raw CID bytes
   - Decode via @ensdomains/content-hash or manual CID.decode()
5. Host fetches CID from IPFS gateway (with 3x retry)
6. Host parses response:
   - CAR archive → extract files
   - Raw HTML → use directly
7. Host saves ProductArchive to Service Worker cache
8. Host renders product in iframe via SW-served URL
```

---

## Contenthash Encoding

DotNS uses ENS-compatible contenthash format via `@ensdomains/content-hash`:

```
Contenthash bytes: [0xe3] [0x01] [CID bytes...]
                    │       │      └─ Raw IPFS CID (multihash)
                    │       └─ Codec marker
                    └─ IPFS namespace (0xe3)
```

### Encoding (Setting Content Hash)

```typescript
import contentHash from '@ensdomains/content-hash';

// CID string → contenthash hex
const encoded = '0x' + contentHash.fromIpfs(cidString);
// Pass to DotnsContentResolver.setContenthash(node, encoded)
```

### Decoding (Reading Content Hash)

```typescript
import contentHash from '@ensdomains/content-hash';

// contenthash hex → CID string
const decoded = contentHash.decode(contenthashHex);
// Returns: "bafybeig..." (IPFS CID string)
```

### Manual Decode (Without Library)

```typescript
import { CID } from 'multiformats/cid';

function decodeContenthash(hex: string): string | null {
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  if (bytes[0] === 0xe3 && bytes.length >= 6) {
    const cidBytes = bytes.slice(2);
    return CID.decode(cidBytes).toString();
  }
  return null;
}
```

---

## Caching Strategy

| Layer          | Storage                            | Scope       | TTL              |
| :------------- | :--------------------------------- | :---------- | :--------------- |
| In-memory      | `resolvedDomains` Map              | Per session | Session lifetime |
| Service Worker | IndexedDB (`triangle-web-host-sw`) | Persistent  | Until replaced   |

**Cache-first strategy:** Check SW cache before fetching from IPFS. Skip IPFS fetch if cached ProductArchive has matching domain.

---

## EVM Resolver Integration

For direct EVM resolution (without Host API context):

```typescript
import { createPublicClient, http } from 'viem';
import { namehash } from 'viem/ens';

const client = createPublicClient({
  transport: http('https://eth-rpc-testnet.polkadot.io/'),
});

// Read contenthash from DotnsContentResolver
const contenthash = await client.readContract({
  address: '0x7756DF72CBc7f062e7403cD59e45fBc78bed1cD7', // DotnsContentResolver
  abi: contentResolverAbi,
  functionName: 'contenthash',
  args: [namehash('myapp.dot')],
});

// Read forward address from DotnsResolver
const addr = await client.readContract({
  address: '0x95645C7fD0fF38790647FE13F87Eb11c1DCc8514', // DotnsResolver
  abi: resolverAbi,
  functionName: 'addressOf',
  args: [namehash('myapp.dot')],
});
```

---

## Substrate Resolver Integration

For PAPI-based resolution (WebSocket transport):

```typescript
import { createClient, getWsProvider } from 'polkadot-api';

const client = createClient(getWsProvider('wss://asset-hub-paseo-rpc.n.dwellir.com'));
const api = client.getTypedApi(descriptors);

// Via Revive dry-run (read-only call)
const result = await api.apis.ReviveApi.call(
  origin,                    // H160 caller address
  contentResolverAddress,    // DotnsContentResolver H160
  0n,                        // value
  undefined,                 // gas limit (auto)
  undefined,                 // storage deposit (auto)
  encodedCallData            // ABI-encoded contenthash(bytes32) call
);
```

---

## Subdomain Resolution for Products

Products register subdomains under a parent domain.

```typescript
import { namehash } from 'viem/ens';

// Check existence
const parentNode = namehash('patr3on.dot');
const subNode = namehash('alice.patr3on.dot');

// Register subnode (parent owner only)
// DotnsRegistry.setSubnodeOwner(parentNode, subNode, ownerAddr)

// Set address record on subnode
// DotnsResolver.setAddress(subNode, contractAddr)

// Set content hash on subnode
// DotnsContentResolver.setContenthash(subNode, contenthashBytes)
```

---

## Reverse Resolution for Display

Replace raw addresses with `.dot` names in UI:

```typescript
// Query reverse name
const name = await resolveReverseName(evmAddress);
// Returns: "alice.dot" or null

// Display priority:
// 1. DotNS domain (if exists)    → "alice.dot"
// 2. Contextual alias (if exists) → "User-42a3"
// 3. Never raw address            → "anon"
```

---

## Error Handling

| Error                     | Cause                          | Resolution                          |
| :------------------------ | :----------------------------- | :---------------------------------- |
| Both resolvers fail       | Chain unavailable              | Retry with exponential backoff (3x) |
| Contenthash empty         | Domain exists but no content   | Show "no content" state             |
| CID decode fails          | Malformed contenthash          | Fall back to raw hex display        |
| IPFS fetch timeout        | Gateway overloaded             | Retry via alternative gateway       |
| CAR parse fails           | Corrupted archive              | Re-fetch from gateway               |
