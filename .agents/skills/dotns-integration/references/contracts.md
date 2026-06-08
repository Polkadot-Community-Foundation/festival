---
quadrant: reference
---

# DotNS Contract Architecture

## Contract System Overview

Nine upgradeable contracts (UUPS proxy pattern) plus two non-upgradeable Store contracts. All deployed on Paseo Asset Hub (chain ID: 420420417).

| Contract                 | Version | Upgradeable | Purpose                              |
| :----------------------- | :------ | :---------- | :----------------------------------- |
| DotnsRegistrarController | v1.2.0  | YES (UUPS)  | Commit-reveal registration + whitelist orchestration |
| DotnsRegistrar           | v1.2.0  | YES (UUPS)  | ERC721 name ownership + transfer store writes |
| DotnsRegistry            | v1.1.0  | YES (UUPS)  | Forward registry: node → (owner, resolver) |
| DotnsResolver            | v1.0.0  | YES (UUPS)  | Forward address resolution: node → ETH address |
| DotnsContentResolver     | v1.0.0  | YES (UUPS)  | Contenthash + text records per node  |
| DotnsReverseResolver     | v1.0.0  | YES (UUPS)  | Reverse mapping: address → .dot name |
| PopRules                 | v1.0.0  | YES (UUPS)  | PoP-aware name classification + pricing |
| DotnsProtocolRegistry    | v1.0.0  | YES (UUPS)  | Central address registry for decoupled discovery |
| StoreFactory             | N/A     | NO          | Deploys per-user Store instances     |
| Store                    | N/A     | NO          | Per-user immutable key-value storage |

---

## Registration Flow

### Commit-Reveal (Public Registration)

```
1. makeCommitment(Registration{label, owner, secret, reserved: false}) → bytes32 hash
2. commit(hash) → stores commitment with timestamp
3. Wait ≥ 6 seconds (minCommitmentAge)
4. register(Registration) → payable, verifies commitment age, checks PoP rules, mints ERC721
   Side effects:
   - Mints token to owner via DotnsRegistrar
   - Sets registry record (owner + resolver) via DotnsRegistry
   - Sets reverse name via DotnsReverseResolver
   - Writes label to user's Store via StoreFactory
   - Refunds excess payment
```

### Reserved Registration (Whitelist)

```
1. registerReserved(Registration{label, owner, secret, reserved: true})
   Access: onlyWhiteListedOrOwner
   No PoP checks. No payment required.
   Same side effects as public registration.
```

### Whitelist Management

| Function                              | Access     | Purpose                              |
| :------------------------------------ | :--------- | :----------------------------------- |
| `whiteListAddress(address, bool)`     | Owner only | Add/remove address from whitelist    |
| `isWhiteListed(address) → bool`       | Public     | Check whitelist status               |

---

## DotnsRegistrar (v1.2.0)

ERC721-backed name ownership. Token ID = `uint256(labelhash)`.

### Key Functions

| Function                                        | Access               | Purpose                              |
| :---------------------------------------------- | :------------------- | :----------------------------------- |
| `register(uint256 tokenId, address owner, string label)` | Controller only | Mint token + store label |
| `syncLabel(uint256 tokenId, string label)`      | Token owner only     | Retroactive label set (pre-v1.2.0 tokens) |
| `labelOf(uint256 tokenId) → string`             | Public               | Get stored label for token           |

### Transfer Behavior (v1.2.0)

On ERC721 transfer (non-zero to non-zero):
1. Queries `DotnsProtocolRegistry` for StoreFactory address
2. Gets or creates recipient's Store via StoreFactory
3. Writes label from `_labels[tokenId]` to recipient's Store
4. Label key: `keccak256("dotns.registered", labelhash)`

**Critical:** Transfer store writes work without sender having a Store. Registrar reads label from its own `_labels` mapping.

---

## DotnsProtocolRegistry (v1.0.0)

Central `bytes32 → address` registry. Contracts query at runtime instead of storing direct references.

### Well-Known Keys

| Key (string)      | Resolves To              |
| :---------------- | :----------------------- |
| `"registrar"`     | DotnsRegistrar address   |
| `"controller"`    | DotnsRegistrarController |
| `"registry"`      | DotnsRegistry            |
| `"reverseResolver"` | DotnsReverseResolver   |
| `"popRules"`      | PopRules                 |
| `"storeFactory"`  | StoreFactory             |

### Functions

| Function                                 | Access     | Purpose                     |
| :--------------------------------------- | :--------- | :-------------------------- |
| `set(bytes32 key, address value)`        | Owner only | Register contract address   |
| `get(bytes32 key) → address`             | Public     | Lookup contract by key      |

### Architecture Rationale

Solves O(n x m) coupling: without registry, every contract stores direct typed references to siblings. Adding a new contract requires upgrading N existing contracts. With registry: add constant + `.get()` call (code change only, no storage layout change).

---

## DotnsRegistry (v1.1.0)

Forward registry: `bytes32 node → (address owner, address resolver)`.

### Key Functions

| Function                                             | Access              | Purpose                        |
| :--------------------------------------------------- | :------------------ | :----------------------------- |
| `setSubnodeOwner(bytes32 parent, bytes32 sub, address owner)` | Parent owner | Create subnode with owner |
| `setOwner(bytes32 node, address owner)`              | Controller only     | Set base node owner            |
| `setResolver(bytes32 node, address resolver)`        | Controller only     | Set node resolver              |
| `ownerOf(bytes32 node) → address`                    | Public              | Get node owner                 |
| `resolverOf(bytes32 node) → address`                 | Public              | Get node resolver              |
| `recordExists(bytes32 node) → bool`                  | Public              | Check node existence           |

### Sentinel Owner Pattern

Tokenized nodes (base domains) use a sentinel owner value in registry. Actual ownership tracked by ERC721 in Registrar. Subnodes use direct owner addresses.

---

## Resolvers

### DotnsResolver (v1.0.0) — Forward Resolution

| Function                                    | Access         | Purpose                    |
| :------------------------------------------ | :------------- | :------------------------- |
| `setAddress(bytes32 node, address value)`   | Node owner     | Set resolved ETH address   |
| `addressOf(bytes32 node) → address`         | Public         | Query resolved address     |

### DotnsContentResolver (v1.0.0) — Content Hash + Text Records

| Function                                                 | Access     | Purpose                     |
| :------------------------------------------------------- | :--------- | :-------------------------- |
| `setContenthash(bytes32 node, bytes contenthash)`        | Node owner | Set IPFS content hash       |
| `contenthash(bytes32 node) → bytes`                      | Public     | Query content hash          |
| `setText(bytes32 node, string key, string value)`        | Node owner | Set text record             |
| `text(bytes32 node, string key) → string`                | Public     | Query text record           |

### DotnsReverseResolver (v1.0.0) — Reverse Resolution

| Function                                           | Access          | Purpose                   |
| :------------------------------------------------- | :-------------- | :------------------------ |
| `setReverseName(address addr, string name)`        | Controller only | Set primary name          |
| `nameOf(address addr) → string`                    | Public          | Query primary .dot name   |

---

## PopRules (v1.0.0) — PoP Classification + Pricing

### Classification Rules

| Label Length | Trailing 2 Digits? | Required PoP Status | Registration Path       |
| :----------- | :------------------ | :------------------ | :---------------------- |
| 1-5          | Any                 | Reserved            | Governance only         |
| 6-8          | NO                  | PopFull             | Commit-reveal + PoP     |
| 6-8          | YES                 | PopLite             | Commit-reveal + PoP     |
| 9+           | NO                  | PopFull             | Commit-reveal + PoP     |
| 9+           | YES                 | NoStatus            | Commit-reveal (open)    |

### PoP Status Tiers

| Tier       | Value | CLI Flag | Pricing              |
| :--------- | :---- | :------- | :------------------- |
| NoStatus   | 0     | `none`   | Rent price (2e15 wei) |
| PopLite    | 1     | `lite`   | Discounted           |
| PopFull    | 2     | `full`   | Free (if eligible)   |
| Reserved   | 3     | N/A      | Governance only      |

### Key Functions

| Function                                                    | Access | Purpose                              |
| :---------------------------------------------------------- | :----- | :----------------------------------- |
| `priceWithCheck(string label, address owner) → PriceResult` | Public | Price + PoP validation               |
| `priceWithoutCheck(string label) → PriceResult`             | Public | Price without PoP validation         |
| `setUserPopStatus(address, PopStatus)`                      | Public | Temporary: self-set PoP tier         |
| `reserveBaseName(string label, address owner)`              | Controller | Time-limited base name reservation |

**Note:** `setUserPopStatus` is temporary. Production: PoP status read from People Chain precompile.

---

## Store System

### StoreFactory (Non-Upgradeable)

| Function                                    | Access | Purpose                          |
| :------------------------------------------ | :----- | :------------------------------- |
| `deploy() → Store`                          | Public | Create Store for caller          |
| `getDeployedStore(address owner) → Store`   | Public | Lookup existing Store            |
| `getOrCreateStore(address owner) → Store`   | Public | Get existing or deploy new Store |

### Store (Non-Upgradeable)

Per-user immutable key-value storage scoped by writer address.

| Function                                            | Access              | Purpose                     |
| :-------------------------------------------------- | :------------------ | :-------------------------- |
| `setValue(bytes32 key, string value)`                | Owner               | Write key-value pair        |
| `setValueFor(address user, bytes32 key, string value)` | Authorized stores | Write for another user      |
| `getValue(bytes32 key) → string`                    | Public              | Read own value              |
| `getValueFor(address user, bytes32 key) → string`   | Public              | Read value for user         |

### Store Locking

DotNS controllers write via `setValueFor()` and lock keys permanently. Locked keys CANNOT be overwritten or deleted.

**Store key derivation:** `keccak256("dotns.registered", labelhash)` → key for domain ownership records.

---

## Node and Label Hashing

```typescript
import { namehash, labelhash } from 'viem/ens';

// Base domain: namehash of "myname.dot"
const node = namehash('myname.dot');

// Token ID: uint256 of labelhash
const tokenId = BigInt(labelhash('myname'));

// Subdomain: namehash of "sub.myname.dot"
const subNode = namehash('sub.myname.dot');
```

---

## Endpoints

### Paseo (Development)

| Service      | URL                                        |
| :----------- | :----------------------------------------- |
| WebSocket    | `wss://asset-hub-paseo-rpc.n.dwellir.com`  |
| ETH-RPC      | `https://eth-rpc-testnet.polkadot.io/`     |
| Chain ID     | 420420417                                  |
| Faucet       | `https://faucet.polkadot.io/?parachain=1000` |

### Bulletin Chain

| Service      | URL                                        |
| :----------- | :----------------------------------------- |
| WebSocket    | `wss://paseo-bulletin-rpc.polkadot.io`     |
| IPFS Gateway | `https://paseo-ipfs.polkadot.io/ipfs/`     |
| Parachain ID | 2487                                       |

### PPN (Local Development)

| Chain           | WebSocket              | Parachain ID |
| :-------------- | :--------------------- | :----------- |
| Asset Hub (EVM) | `ws://127.0.0.1:10020` | 1000         |
| Bulletin        | `ws://127.0.0.1:10030` | 2487         |

---

## SDK Integration (TypeScript)

### Client Setup (CLI/Scripts Only)

```typescript
import { createClient, getWsProvider } from 'polkadot-api';
import { getPolkadotSigner } from 'polkadot-api/signer';
import { DEV_PHRASE, sr25519CreateDerive } from '@polkadot-labs/hdkd';

// Connect to naming chain
const client = createClient(getWsProvider('wss://asset-hub-paseo-rpc.n.dwellir.com'));

// Derive signer from mnemonic
const derive = sr25519CreateDerive(DEV_PHRASE);
const keypair = derive('//Alice');
const signer = getPolkadotSigner(keypair.publicKey, 'Sr25519', keypair.sign);
```

**Note:** Direct `getWsProvider` is for CLI/deployment scripts. Production DApps MUST use container app context via Host API.

### EVM Address Mapping

```typescript
// Substrate → EVM address (REQUIRED before first contract call)
await api.tx.Revive.mapAccount().signAndSubmit(signer);
const evmAddress = await api.apis.Revive.accountToEvmAddress(substrateAddress);
```

### Domain Lookup via Runtime API

```typescript
// Forward resolution
const address = await api.apis.DotnsResolver.addr('myname.dot');

// Reverse resolution
const name = await api.apis.DotnsReverseResolver.nameOf(evmAddress);

// Content hash
const cid = await api.apis.DotnsResolver.contenthash('myname.dot');
```
