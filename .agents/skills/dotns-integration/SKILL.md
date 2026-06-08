---
name: dotns-integration
description: "Integrate DotNS decentralized naming (.dot domains), Bulletin Chain content hosting, and CI/CD deployment into Polkadot applications. Covers contract interactions via Revive, CLI domain management, GitHub Actions reusable workflows, and browser-side dual-chain resolution. Triggers on: 'dotns', 'dot domain', 'register domain', 'deploy to dotns', 'content hash', 'bulletin upload', 'dotns ci'."
---

# DotNS Integration

## 1. Mode & Protocol

**MODE:** AUSTERE REFERENCE (Diataxis)
**ROLE:** DotNS Integration Engineer
**CONSTRAINT:** Routing engine. MUST load Global Invariants before processing. Chain is the database — no servers, no indexers.

---

## 2. Global Invariants (Base Layer)

These standards apply to every execution path. MUST load before processing any request.

- **Contract Architecture:** `references/contracts.md`
- **CLI Commands:** `references/cli-commands.md`

MUST load ALL Global Invariant files on every execution. NEVER proceed to Local Artifacts without loading Globals first.

### Critical Constants (Hot Path)

| Constant              | Value                                     | Purpose                           |
| :-------------------- | :---------------------------------------- | :-------------------------------- |
| Chain ID (Paseo)      | 420420417                                 | EVM chain identifier              |
| Max Single Upload     | 8 MB                                      | Bulletin Chain tx limit           |
| Commitment Min Age    | 6 seconds                                 | Commit-reveal anti-frontrun       |
| Commitment Max Age    | 1 day                                     | Commitment expiry                 |
| Rent Price (NoStatus) | 2e15 wei (0.002 PAS)                      | Anti-spam for unverified accounts |
| CLI Version           | 0.4.1                                     | Current `@dotns/cli` release      |
| Default RPC           | `wss://asset-hub-paseo-rpc.n.dwellir.com` | Naming chain endpoint             |
| Bulletin RPC          | `wss://paseo-bulletin-rpc.polkadot.io`    | Bulletin chain endpoint           |
| IPFS Gateway          | `https://paseo-ipfs.polkadot.io/ipfs/`    | Content retrieval                 |

### Contract Addresses (Paseo Asset Hub)

| Contract                 | Address                                      |
| :----------------------- | :------------------------------------------- |
| StoreFactory             | `0x030296782F4d3046B080BcB017f01837561D9702` |
| DotnsRegistrar           | `0x329aAA5b6bEa94E750b2dacBa74Bf41291E6c2BD` |
| DotnsReverseResolver     | `0x95D57363B491CF743970c640fe419541386ac8BF` |
| DotnsRegistry            | `0x4Da0d37aBe96C06ab19963F31ca2DC0412057a6f` |
| DotnsContentResolver     | `0x7756DF72CBc7f062e7403cD59e45fBc78bed1cD7` |
| DotnsResolver            | `0x95645C7fD0fF38790647FE13F87Eb11c1DCc8514` |
| PopRules                 | `0x4e8920B1E69d0cEA9b23CBFC87A17Ee6fE02d2d3` |
| DotnsRegistrarController | `0xd09e0F1c1E6CE8Cf40df929ef4FC778629573651` |
| DotnsProtocolRegistry    | `0xF8531342444fAC0A75719130eECcf45314584EFe` |

### Mental Model

State is the source of truth. Events are for observability. Discovery MUST be deterministic — if something is created, store where to find it. NEVER require replaying logs from genesis to recover user state.

---

## 3. Decision Matrix

Locate the matching row. The **Local Artifacts** column determines which files to load alongside the Global Invariants.

| User Intent                          | Complexity | Risk     | Local Artifacts                                                             |
| :----------------------------------- | :--------- | :------- | :-------------------------------------------------------------------------- |
| Register a `.dot` domain             | Medium     | `Medium` | `references/contracts.md`                                                   |
| Register a subdomain under parent    | Medium     | `Medium` | `references/contracts.md`                                                   |
| Upload content to Bulletin Chain     | Low        | `Low`    | `references/cli-commands.md`                                                |
| Set or resolve content hash          | Low        | `Low`    | `references/contracts.md`, `references/cli-commands.md`                     |
| Set up CI/CD deployment workflow     | Medium     | `Low`    | `references/ci-cd-workflows.md`                                             |
| Set up PR preview deploys            | Medium     | `Low`    | `references/ci-cd-workflows.md`                                             |
| Deploy mono-repo with multiple apps  | High       | `Medium` | `references/ci-cd-workflows.md`                                             |
| Resolve `.dot` domain in browser     | High       | `Medium` | `references/runtime-resolution.md`                                          |
| Integrate DotNS SDK in TypeScript    | High       | `Medium` | `references/contracts.md`, `references/runtime-resolution.md`               |
| Manage text records for domain       | Low        | `Low`    | `references/cli-commands.md`                                                |
| Manage per-user Store data           | Medium     | `Low`    | `references/contracts.md`, `references/cli-commands.md`                     |
| Whitelist address for reserved names | Low        | `Medium` | `references/contracts.md`                                                   |
| Understand PoP pricing tiers         | Low        | `Low`    | `references/contracts.md`                                                   |
| Out-of-scope (contract development)  | N/A        | N/A      | **STOP** — Contract source lives in `paritytech/dotns`. Not an SDK concern. |

---

## 4. Contrastive Exemplars

### CORRECT: Domain Registration — Commit-Reveal vs Direct

| Dimension    | PASS (Commit-Reveal)                       | FAIL (Direct Registration)             |
| :----------- | :----------------------------------------- | :------------------------------------- |
| Flow         | `commit(hash)` → wait 6s → `register(reg)` | `register(reg)` in single transaction  |
| Frontrunning | Secret commitment prevents name sniping    | Mempool watchers steal desirable names |
| Pricing      | PoP tier checked at reveal time            | No PoP enforcement possible            |
| Store writes | Label written to user's Store on register  | No persistent ownership record         |

**Why this matters:** Direct registration exposes name selection to mempool frontrunning. The commit-reveal pattern with minimum 6-second age ensures the registrant's intent is hidden until reveal.

---

### CORRECT: Subdomain Strategy — Hierarchy vs Flat

| Dimension  | PASS (Hierarchical)                  | FAIL (Flat)                                |
| :--------- | :----------------------------------- | :----------------------------------------- |
| PR preview | `pr123.myapp.dot`                    | `myapp-pr-123.dot` (separate registration) |
| Production | `myapp.dot`                          | `main.myapp.dot` (unnecessary subname)     |
| Creator    | `alice.patr3on.dot`                  | `alice-patr3on.dot` (no hierarchy)         |
| Cost       | Subnames are free under owned parent | Each flat name requires separate payment   |
| Discovery  | Enumerate subnodes from known parent | Scan all names matching prefix             |

**Why this matters:** Flat naming requires separate registration (and payment) per entry and prevents deterministic discovery. Hierarchical subnodes under an owned parent domain are free to create and enumerable on-chain.

---

### CORRECT: Content Upload — Size-Aware vs Single Path

| Dimension | PASS (Size-Aware)                             | FAIL (Single Path)               |
| :-------- | :-------------------------------------------- | :------------------------------- |
| < 8 MB    | Single `dotns bulletin upload`                | Manual chunking (unnecessary)    |
| > 8 MB    | `--force-chunked` with DAG-PB Merkle tree     | Single upload (transaction fail) |
| Unchanged | Re-deploy (CID cache skips upload)            | Delete and re-upload             |
| Parallel  | `--parallel --concurrency 15` for multi-block | Sequential block submission      |

**Why this matters:** Bulletin Chain enforces 8 MB per transaction. Files exceeding this limit MUST use chunked DAG-PB format. The CLI handles this automatically with `--force-chunked`, constructing a Merkle tree of content blocks.

---

### CORRECT: CI Deploy — Reusable Workflow vs Custom Script

| Dimension  | PASS (Reusable Workflow)                                       | FAIL (Custom Script)               |
| :--------- | :------------------------------------------------------------- | :--------------------------------- |
| Workflow   | `uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main` | Custom shell script calling CLI    |
| Caching    | Content-addressable cache skips unchanged builds               | Re-uploads every time              |
| Secrets    | `dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}`          | Hardcoded mnemonic in repo         |
| Sequential | `needs: [build, previous-deploy]` for shared mnemonic          | Parallel deploys (nonce collision) |
| Retry      | `max-retries: 3`, `retry-delay: 15s` built in                  | No retry logic                     |

**Why this matters:** The reusable workflow handles content-addressable caching (skip upload if CID matches), retry logic for transient failures, and proper secret management. Custom scripts miss these and risk nonce collisions when deploying multiple apps with the same mnemonic.

---

### CORRECT: Subname Deploy — `subname` Input vs Multi-Level Basename

| Dimension    | PASS (`subname` input)                          | FAIL (multi-level basename)                |
| :----------- | :---------------------------------------------- | :----------------------------------------- |
| Basename     | `basename: myapp` (single valid label)          | `basename: stg.myapp` (contains dot)       |
| Subname      | `subname: stg`, `mode: preview`                 | Not set (relies on basename containing dot) |
| Registration | Workflow auto-registers subname under parent    | `register-base` fails: "Invalid label"     |
| Content set  | `dotns content set stg.myapp <cid>` via namehash | Same (works), but registration path broken |

**Why this matters:** The CLI validates domain labels — dots are not allowed. Using `subname: stg` with `mode: preview` uses the proper subname registration path (`dotns register subname --name stg --parent myapp`). Multi-level basenames bypass the type system and fail at registration.

---

### CORRECT: Runtime Resolution — Dual-Chain Racing vs Single Resolver

| Dimension  | PASS (Dual-Chain Racing)           | FAIL (Single Resolver)      |
| :--------- | :--------------------------------- | :-------------------------- |
| Resolvers  | `Promise.any([evm, substrate])`    | Single resolver (slow path) |
| Latency    | ~100ms (fastest resolver wins)     | ~500ms+ (fixed path)        |
| Resilience | Either chain down → still resolves | Single point of failure     |
| Transport  | HTTP (EVM) + WebSocket (Substrate) | WebSocket only              |

**Why this matters:** The Triangle Web Host resolves `.dot` domains by racing EVM (viem HTTP, ~100ms) against Substrate (PAPI WebSocket, ~500ms). First response wins via `Promise.any()`. Single-resolver implementations lose both speed and resilience.

---

## 5. Contextual Injection Requirement

<dynamic_rule>
At integration step, verify all DotNS operations against these constraints.
Recency bias ensures highest adherence for this section.
</dynamic_rule>

### Critical Validation (Score 5)

REQUIRE `mapAccount()` called before first EVM contract interaction — unmapped addresses cause silent failures.
REQUIRE commit-reveal flow for all public registrations — direct registration is NOT supported by the controller.
IF content > 8 MB: REQUIRE chunked upload via DAG-PB format.

### Security Boundaries (Score 3)

FORBIDDEN: Hardcoded mnemonic in repository or workflow file.
FORBIDDEN: Parallel deploys with same mnemonic (nonce collision).
NEVER expose private keys in CI logs — use GitHub Secrets exclusively.

### Output Formatting (Score 2)

FORMAT_OUTPUT: Contract addresses as checksummed EVM hex (`0x...`).
VALIDATE: Content hash uses `@ensdomains/content-hash` encoding (`0xe3 0x01 <CID bytes>`).
