/**
 * Grant a Festival role to an account, signing with a Substrate (sr25519) mnemonic.
 *
 * The Festival contract is an EVM (pallet-revive) contract, so roles are keyed by
 * H160. But you'll usually have the grantee's SS58 address. This script accepts
 * an SS58 (or a raw 0x H160), derives the H160 the way pallet-revive maps a native
 * Substrate account (keccak256(accountId32)[12..32]), and grants the role to it.
 *
 * It reads current state first, prints the dry-run outcome, and pauses for
 * confirmation before signing. Nothing is sent until you type "yes".
 *
 * Usage:
 *   NETWORK=paseo-next-v2 DEPLOYER_SEED="<12/24-word mnemonic>" \
 *     npx tsx scripts/grant-festival-role.ts <SS58_OR_H160> [ROLE]
 *
 *   ROLE defaults to DEFAULT_ADMIN_ROLE. Other values: MANAGER_ROLE, VOLUNTEER_ROLE.
 *   Pass --yes to skip the confirmation prompt.
 *
 * Env:
 *   NETWORK            (recommended) paseo-next-v2. Selects RPC + native decimals
 *   DEPLOYER_SEED      (required) mnemonic of an account holding the role's admin role
 *   FESTIVAL_ADDRESS   (optional) override; defaults to VITE_FESTIVAL_ADDRESS / next-v2 prod
 */

import dotenv from "dotenv";
dotenv.config({ quiet: true });
dotenv.config({ path: "contracts/.env", quiet: true });

import { createClient, Binary } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import type { PolkadotSigner } from "polkadot-api/signer";
import { AccountId } from "@polkadot-api/substrate-bindings";
import {
  decodeFunctionResult,
  encodeFunctionData,
  keccak256,
  toHex,
  type Abi,
} from "viem";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { getNetworkConfig } from "../lib/network";
import {
  createSigner,
  deriveH160,
  loadArtifact,
  callContract,
  DRY_RUN_DEPOSIT,
} from "./deploy-festival";

// ── Resolve role name → bytes32 ──

const KNOWN_ROLES = [
  "DEFAULT_ADMIN_ROLE",
  "MANAGER_ROLE",
  "VOLUNTEER_ROLE",
] as const;

function roleHash(name: string): `0x${string}` {
  if (!KNOWN_ROLES.includes(name as (typeof KNOWN_ROLES)[number])) {
    throw new Error(
      `Unknown role "${name}". Expected one of: ${KNOWN_ROLES.join(", ")}.\n` +
        `(If you meant to set the festival address, pass it as an env var BEFORE npx: ` +
        `FESTIVAL_ADDRESS=0x... npx tsx scripts/grant-festival-role.ts <addr> — not as a positional argument.)`,
    );
  }
  if (name === "DEFAULT_ADMIN_ROLE") return `0x${"00".repeat(32)}`;
  return keccak256(toHex(name));
}

// ── Read a view function via pallet-revive dry-run ──

async function readView(
  api: any,
  abi: Abi,
  contract: `0x${string}`,
  functionName: string,
  args: unknown[],
  origin: string,
): Promise<unknown> {
  const calldata = encodeFunctionData({ abi, functionName, args });
  const dryRun = await api.apis.ReviveApi.call(
    origin,
    contract.toLowerCase(),
    0n,
    undefined,
    DRY_RUN_DEPOSIT,
    Binary.fromHex(calldata),
  );
  if (!dryRun.result.success || dryRun.result.value.flags & 1) {
    throw new Error(
      `read ${functionName}() reverted: ${JSON.stringify(dryRun.result, bigintReplacer)}`,
    );
  }
  const returnData = Binary.toHex(dryRun.result.value.data) as `0x${string}`;
  if (returnData === "0x") {
    throw new Error(
      `No contract responded at ${contract} on this network (read ${functionName}() returned empty). ` +
        `The address has no code here — check that FESTIVAL_ADDRESS matches the festival deployed on NETWORK=${process.env.NETWORK ?? "(unset)"}.`,
    );
  }
  return decodeFunctionResult({ abi, functionName, data: returnData });
}

const bigintReplacer = (_k: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v;

// ── grantRole ──

/**
 * Grant a Festival role to a resolved H160 grantee: preflight reads, optional
 * confirmation, submission, and verification. The caller owns the client.
 * Returns `{ alreadyHad: true }` when the role was already held.
 */
export async function grantRole(opts: {
  api: any;
  signer: PolkadotSigner;
  ss58: string;
  festival: `0x${string}`;
  granteeH160: `0x${string}`;
  roleName?: string;
  granteeLabel?: string;
  skipConfirm?: boolean;
}): Promise<{ alreadyHad: boolean; granted: boolean; txHash?: `0x${string}` }> {
  const { api, signer, ss58, festival, granteeH160 } = opts;
  const roleName = opts.roleName ?? "DEFAULT_ADMIN_ROLE";
  const role = roleHash(roleName);
  const signerH160 = deriveH160(AccountId(42).enc(ss58));
  const { abi } = loadArtifact("Festival");

  console.error("=== Grant Festival role ===");
  console.error(`  Festival:  ${festival}`);
  console.error(`  Role:      ${roleName} (${role})`);
  console.error(`  Signer:    ${ss58}`);
  console.error(`             → H160 ${signerH160}`);
  console.error(`  Grantee:   ${opts.granteeLabel ?? "(raw H160)"}`);
  console.error(`             → H160 ${granteeH160}`);
  console.error("");

  // Preflight reads: can the signer grant this role, and is it already held?
  const adminRole = (await readView(
    api,
    abi,
    festival,
    "getRoleAdmin",
    [role],
    ss58,
  )) as `0x${string}`;
  const signerCanGrant = (await readView(
    api,
    abi,
    festival,
    "hasRole",
    [adminRole, signerH160],
    ss58,
  )) as boolean;
  const alreadyHas = (await readView(
    api,
    abi,
    festival,
    "hasRole",
    [role, granteeH160],
    ss58,
  )) as boolean;

  console.error(
    `  Signer holds admin-of-role (${adminRole.slice(0, 10)}…): ${signerCanGrant}`,
  );
  console.error(
    `  Grantee already has role:                       ${alreadyHas}`,
  );
  console.error("");

  if (alreadyHas) {
    console.error("Grantee already holds this role. Nothing to do.");
    return { alreadyHad: true, granted: false };
  }
  if (!signerCanGrant) {
    throw new Error(
      `Signer ${signerH160} does NOT hold the admin role required to grant ${roleName}. Aborting.`,
    );
  }

  if (!opts.skipConfirm) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    const answer = await rl.question(
      `Submit grantRole(${roleName}, ${granteeH160})? Type "yes" to proceed: `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.error("Aborted — nothing submitted.");
      return { alreadyHad: false, granted: false };
    }
  }

  const { txHash } = await callContract(
    festival,
    "Festival",
    "grantRole",
    [role, granteeH160],
    api,
    signer,
    ss58,
  );

  // Verify on-chain post-state.
  const nowHas = (await readView(
    api,
    abi,
    festival,
    "hasRole",
    [role, granteeH160],
    ss58,
  )) as boolean;
  console.error("");
  console.error(`Done. tx: ${txHash}`);
  console.error(`Grantee now has ${roleName}: ${nowHas}`);
  return { alreadyHad: false, granted: nowHas, txHash };
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--yes");
  const skipConfirm = process.argv.includes("--yes");

  const grantee = args[0];
  const roleName = args[1] ?? "DEFAULT_ADMIN_ROLE";

  if (!grantee) {
    throw new Error(
      "Usage: grant-festival-role.ts <SS58_OR_H160> [ROLE] [--yes]",
    );
  }

  const network = getNetworkConfig();
  const WS_URL = network.mainChain.wsUrl;
  const festival = (process.env.FESTIVAL_ADDRESS ||
    process.env.VITE_FESTIVAL_ADDRESS ||
    "0xfbdcc95702cd0f377d950257af0255e8985fec50") as `0x${string}`;

  // Resolve grantee H160. If they passed an SS58, derive the H160 the way
  // pallet-revive maps a native Substrate account.
  let granteeH160: `0x${string}`;
  let granteeSs58: string | null = null;
  if (/^0x[0-9a-fA-F]{40}$/.test(grantee)) {
    granteeH160 = grantee.toLowerCase() as `0x${string}`;
  } else {
    const publicKey = AccountId(42).enc(grantee); // SS58 string → 32-byte account id
    granteeH160 = deriveH160(publicKey);
    granteeSs58 = grantee;
  }

  const { signer, ss58 } = createSigner();

  console.error(`  Network:   ${network.key} (${WS_URL})`);

  const client = createClient(getWsProvider(WS_URL));
  const api = client.getUnsafeApi();

  try {
    await grantRole({
      api,
      signer,
      ss58,
      festival,
      granteeH160,
      roleName,
      granteeLabel: granteeSs58 ?? "(raw H160)",
      skipConfirm,
    });
  } finally {
    client.destroy();
  }
}

// Run as a CLI only when invoked directly; importing must not grant.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("\nFailed:", err?.message || err);
    process.exit(1);
  });
}
