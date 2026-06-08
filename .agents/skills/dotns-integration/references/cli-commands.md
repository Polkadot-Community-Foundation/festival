---
quadrant: reference
---

# DotNS CLI Command Reference

## Installation

```bash
npm install -g @dotns/cli    # npm
bun add -g @dotns/cli        # bun
npx @dotns/cli --help        # one-off
```

Binary name: `dotns`. Version: 0.4.1.

---

## Authentication

All commands accept auth options. Priority: explicit flag > environment variable > default keystore.

### Auth Options (Global)

| Flag                    | Environment Variable      | Purpose                               |
| :---------------------- | :------------------------ | :------------------------------------ |
| `--mnemonic <phrase>`   | `DOTNS_OWNER_MNEMONIC`    | BIP39 mnemonic                        |
| `--key-uri <uri>`       | `DOTNS_KEY_URI`           | Substrate derivation (e.g. `//Alice`) |
| `--account <name>`      | —                         | Saved keystore account                |
| `--password <pwd>`      | `DOTNS_KEYSTORE_PASSWORD` | Decrypt keystore                      |
| `--keystore-path <dir>` | `DOTNS_KEYSTORE_PATH`     | Custom keystore directory             |

### Auth Management

| Command                    | Purpose                        |
| :------------------------- | :----------------------------- |
| `dotns auth create`        | Create and encrypt new account |
| `dotns auth list`          | Show saved accounts            |
| `dotns auth delete`        | Remove account                 |
| `dotns auth set-default`   | Mark account as default        |
| `dotns auth clear-history` | Remove all accounts            |

### Environment Variables

| Variable                | Purpose                 | Default                                   |
| :---------------------- | :---------------------- | :---------------------------------------- |
| `DOTNS_RPC`             | Naming chain endpoint   | `wss://asset-hub-paseo-rpc.n.dwellir.com` |
| `DOTNS_BULLETIN_RPC`    | Bulletin chain endpoint | `wss://paseo-bulletin-rpc.polkadot.io`    |
| `DOTNS_MIN_BALANCE_PAS` | Minimum balance check   | `1000000000` (1 PAS)                      |

---

## Domain Registration

### Register Base Domain

```bash
dotns register domain <label> [options]
```

| Option              | Default | Purpose                                |
| :------------------ | :------ | :------------------------------------- |
| `--status <tier>`   | `none`  | PoP tier: `none`, `lite`, `full`       |
| `--reverse`         | false   | Set reverse record                     |
| `--governance`      | false   | Governance registration path           |
| `--transfer`        | false   | Transfer to `--to` after registration  |
| `--to <address>`    | —       | Transfer recipient (with `--transfer`) |
| `--owner <address>` | caller  | Set different owner                    |

**Flow:** Commit → wait 6 seconds → reveal → register. CLI handles the wait automatically.

### Register Subdomain

```bash
dotns register subname --name <label> --parent <domain> [options]
```

| Option              | Default | Purpose         |
| :------------------ | :------ | :-------------- |
| `--owner <address>` | caller  | Subdomain owner |

**Prerequisite:** Caller MUST own the parent domain.

---

## Domain Lookup

### Lookup Domain Info

```bash
dotns lookup info <domain>          # Human-readable
dotns lookup info <domain> --json   # JSON output
```

Returns: owner (EVM + SS58), resolver, address record, content hash, registration status, balance.

### List Owned Domains

```bash
dotns lookup list                   # All domains owned by caller
dotns lookup list --json
```

---

## Content Hash Management

### Set Content Hash

```bash
dotns content set <domain> <cid>
```

Encodes CID using `@ensdomains/content-hash` (IPFS namespace `0xe3 0x01 <CID bytes>`).

### Get Content Hash

```bash
dotns content get <domain>
```

Returns decoded IPFS CID string.

---

## Text Records

### Set Text Record

```bash
dotns text set <domain> <key> <value>
```

Arbitrary key-value pairs. Common keys: `email`, `url`, `description`, `avatar`, `com.twitter`, `com.github`.

### Get Text Record

```bash
dotns text get <domain> <key>
```

### List All Text Records

```bash
dotns text list <domain>
```

---

## Bulletin Chain Operations

### Upload File

```bash
dotns bulletin upload <path> [options]
```

| Option                | Default | Purpose                              |
| :-------------------- | :------ | :----------------------------------- |
| `--force-chunked`     | false   | Use DAG-PB Merkle tree format        |
| `--parallel`          | false   | Upload blocks concurrently           |
| `--concurrency <n>`   | 15      | Parallel upload thread count         |
| `--print-contenthash` | false   | Output ENS contenthash alongside CID |
| `--history`           | false   | Save upload metadata locally         |

**Size limits:** Files < 8 MB upload as single transaction. Files > 8 MB MUST use `--force-chunked`.

**CID calculation:** Blake2b-256 hash → IPFS CID v1.

### Pre-Authorize Uploads

```bash
dotns bulletin authorize [options]
```

| Option               | Default | Purpose                             |
| :------------------- | :------ | :---------------------------------- |
| `--transactions <n>` | —       | Number of transactions to authorize |
| `--bytes <n>`        | —       | Bytes quota to authorize            |

### Upload History

```bash
dotns bulletin history              # Show upload history
dotns bulletin history --clear      # Clear all history
dotns bulletin history --remove <cid>  # Remove specific entry
```

---

## Proof of Personhood

### Set PoP Status

```bash
dotns pop set <domain> <status>
```

Status values: `none` (0), `lite` (1), `full` (2).

**Note:** Temporary self-set mechanism. Production: PoP status from People Chain precompile.

---

## Account Management

### Account Info

```bash
dotns account info
```

Shows: SS58 address, EVM address, account type.

### Account Balance

```bash
dotns account balance
```

Shows: native token balance on naming chain.

---

## Store Management

### Create Store

```bash
dotns store create
```

Deploys per-user Store contract via StoreFactory.

### Store Info

```bash
dotns store info
```

Shows: deployed Store address (if exists).

### Write to Store

```bash
dotns store write <key> <value>
```

Writes key-value pair to caller's Store.

---

## Global Options

| Option             | Purpose                       |
| :----------------- | :---------------------------- |
| `--json`           | JSON output (all commands)    |
| `--rpc <endpoint>` | Custom WebSocket RPC endpoint |

---

## Troubleshooting

| Error                     | Cause                    | Resolution                  |
| :------------------------ | :----------------------- | :-------------------------- |
| `Nonce collision`         | Parallel operations      | Serialize transactions      |
| `Account not mapped`      | First EVM call           | Call `mapAccount()` first   |
| `Insufficient balance`    | < 1 PAS                  | Fund account via faucet     |
| `Commitment too young`    | < 6 seconds since commit | Wait and retry              |
| `Name already registered` | Domain taken             | Choose different name       |
| `Size exceeds limit`      | > 8 MB single upload     | Use `--force-chunked`       |
| `Unauthorized`            | Wrong signer for domain  | Check domain ownership      |
| `Not whitelisted`         | Reserved registration    | Contact owner for whitelist |
