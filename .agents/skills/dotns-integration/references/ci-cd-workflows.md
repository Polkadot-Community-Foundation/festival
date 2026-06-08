---
quadrant: reference
---

# DotNS CI/CD Workflows

## Reusable Workflow

The `paritytech/dotns-sdk` repository provides a reusable GitHub Actions workflow for automated static site deployment to DotNS domains.

```yaml
uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
```

---

## Workflow Inputs

| Input                | Required | Default     | Purpose                                             |
| :------------------- | :------- | :---------- | :-------------------------------------------------- |
| `basename`           | YES      | —           | Base domain label without `.dot`                    |
| `artifact-name`      | YES      | —           | Name of uploaded build artifact                     |
| `mode`               | NO       | `preview`   | `production` (base domain) or `preview` (subname)   |
| `subname`            | NO       | —           | Explicit subname override for preview deployments   |
| `subname-format`     | NO       | `pr-number` | Preview subname: `pr-number`, `branch`, `sha-short` (ignored if `subname` is set) |
| `register-base`      | NO       | `false`     | Register base domain if not owned                   |
| `use-car`            | NO       | `false`     | Merkleize with IPFS CLI, upload as CAR file         |
| `parallel`           | NO       | `true`      | Upload blocks concurrently                          |
| `upload-concurrency` | NO       | `15`        | Parallel block count                                |
| `skip-cache`         | NO       | `false`     | Force re-upload (ignore content hash cache)         |
| `max-retries`        | NO       | `3`         | Retry count for transient failures                  |
| `retry-delay`        | NO       | `15s`       | Delay between retries                               |

---

## Workflow Secrets

| Secret              | Required | Purpose                                                        |
| :------------------ | :------- | :------------------------------------------------------------- |
| `dotns-mnemonic`    | YES      | BIP39 mnemonic for DotNS operations                            |
| `bulletin-mnemonic` | NO       | Separate mnemonic for Bulletin uploads (defaults to `//Alice`) |

---

## Workflow Outputs

| Output      | Description                                          |
| :---------- | :--------------------------------------------------- |
| `cid`       | IPFS CID of uploaded content                         |
| `fqdn`      | Fully qualified domain name (e.g. `pr42.myapp.dot`)  |
| `url`       | Gateway URL (e.g. `https://pr42.myapp.paseo.li`)     |
| `cache-hit` | `true` if deployment used cached content (no upload) |

---

## Workflow Flow

```
1. Resolve target domain:
   - production: basename.dot
   - preview: {subname}.{basename}.dot
2. Compute build hash from artifact contents
3. Check deployment cache (skip upload if hash matches previous deploy)
4. If use-car: Merkleize artifact with IPFS CLI into CAR file
5. Upload to Bulletin Chain via dotns CLI
   - parallel + concurrency settings apply
   - max-retries + retry-delay for transient failures
6. Register domain/subname if needed (register-base flag)
7. Set contenthash on domain → uploaded CID
8. Output results to GitHub Actions summary
```

---

## Production Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy to DotNS

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: |
          npm ci
          npm run build
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: site
          path: dist/

  deploy:
    needs: build
    uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
    with:
      basename: myapp
      artifact-name: site
      mode: production
      register-base: false
    secrets:
      dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}
```

---

## PR Preview Deploy

```yaml
# .github/workflows/preview.yml
name: PR Preview

on:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: |
          npm ci
          npm run build
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: site
          path: dist/

  deploy-preview:
    needs: build
    uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
    with:
      basename: myapp
      artifact-name: site
      mode: preview
      subname-format: pr-number
    secrets:
      dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}
```

### Subname Format Options

| Format      | Example URL for PR #42 | Example URL for branch `feat-x` |
| :---------- | :--------------------- | :------------------------------ |
| `pr-number` | `pr42.myapp.dot`       | N/A (PR context only)           |
| `branch`    | N/A                    | `feat-x.myapp.dot`              |
| `sha-short` | `a1b2c3d.myapp.dot`    | `a1b2c3d.myapp.dot`             |

### Explicit Subname Override

Use the `subname` input to deploy to a fixed subname (e.g. staging environments). When `subname` is set, `subname-format` is ignored.

```yaml
  deploy-staging:
    uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
    with:
      basename: myapp
      artifact-name: site
      mode: preview
      subname: stg
    secrets:
      dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}
```

This deploys to `stg.myapp.dot`. The workflow automatically registers the subname under the parent if it doesn't exist.

---

## Mono-Repo Sequential Deploys

Multiple apps sharing one mnemonic MUST deploy sequentially. Parallel deploys cause nonce collisions.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # Build all apps, upload each as separate artifact

  deploy-app:
    needs: build
    uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
    with:
      basename: myapp
      artifact-name: app-dist
      mode: production
    secrets:
      dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}

  deploy-docs:
    needs: deploy-app # SEQUENTIAL — prevents nonce collision
    uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
    with:
      basename: myapp-docs
      artifact-name: docs-dist
      mode: production
    secrets:
      dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}
```

---

## CAR File Upload Mode

For large sites or when IPFS-native merkleization is preferred:

```yaml
deploy:
  needs: build
  uses: paritytech/dotns-sdk/.github/workflows/deploy.yml@main
  with:
    basename: myapp
    artifact-name: site
    mode: production
    use-car: true
    parallel: true
    upload-concurrency: 15
  secrets:
    dotns-mnemonic: ${{ secrets.DOTNS_OWNER_MNEMONIC }}
```

**CAR mode flow:** Artifact → IPFS CLI merkleization → CAR file → chunked Bulletin upload. Produces standard IPFS DAG structure.

---

## Content-Addressable Cache

The workflow computes a content hash of the build artifact. If the hash matches the previous deploy, the upload step is skipped entirely. This:

- Speeds up deploys with unchanged builds
- Reduces Bulletin Chain transaction costs
- Returns `cache-hit: true` in outputs

Override with `skip-cache: true` to force re-upload.

---

## Integration Checklist

| Check                                    | Status   |
| :--------------------------------------- | :------- |
| `DOTNS_OWNER_MNEMONIC` secret configured | REQUIRED |
| Domain registered before first deploy    | REQUIRED |
| Sequential deploys for shared mnemonic   | REQUIRED |
| Build artifact uploaded before deploy    | REQUIRED |
| Base domain ownership verified           | REQUIRED |
| Content-addressable caching enabled      | DEFAULT  |
| PR preview subname format configured     | OPTIONAL |
| Separate bulletin-mnemonic if needed     | OPTIONAL |
