// Test helpers for revive integration tests.
//
// These are NOT optional — running against a real revive node (vs hardhat's
// in-memory EVM) introduces flake modes that hardhat-viem's defaults don't
// handle:
//   - "Priority too low" / "Timed out" RPC errors when txs queue up
//   - reverts that surface either at simulation (eth_call) or at receipt
//     (status: "reverted") depending on the failure mode
//   - non-snapshottable state (no evm_snapshot/evm_revert against revive)

import hre from "hardhat";
import { expect } from "chai";
import type { Hex } from "viem";

export async function sendWithRetry(
	label: string,
	sendFn: () => Promise<Hex>,
	opts?: { retries?: number; receiptTimeout?: number },
): Promise<{ status: string; blockNumber: bigint; [k: string]: unknown }> {
	const publicClient = await hre.viem.getPublicClient();
	const maxAttempts = opts?.retries ?? 5;
	const timeout = opts?.receiptTimeout ?? 8_000;

	// Capture the tx hash once. If waitForTransactionReceipt times out, the tx
	// is still pending in the mempool — re-poll the same hash. Calling sendFn()
	// again would mint a new nonce and submit a duplicate tx, which corrupts
	// any non-idempotent state change.
	let hash: Hex | undefined;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			if (!hash) hash = await sendFn();
			const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout });
			if (receipt.status === "reverted") {
				throw new Error(`${label} reverted in block ${receipt.blockNumber}`);
			}
			return receipt;
		} catch (e: unknown) {
			const msg = (e as Error).message;
			if (attempt < maxAttempts && (msg.includes("Timed out") || msg.includes("Priority"))) {
				await waitForNextBlock();
				continue;
			}
			throw e;
		}
	}
	throw new Error(`${label} failed after ${maxAttempts} attempts`);
}

export async function waitForNextBlock(): Promise<void> {
	const publicClient = await hre.viem.getPublicClient();
	const current = await publicClient.getBlockNumber();
	for (let i = 0; i < 30; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		const now = await publicClient.getBlockNumber();
		if (now > current) return;
	}
	throw new Error(`Timed out waiting for block > ${current} after 30s`);
}

// Generic: assert that an async function throws and the error message
// contains a substring. Use for read-path reverts (eth_call simulation
// throws synchronously) where there's no tx to wait on.
export async function expectThrows(
	label: string,
	fn: () => Promise<unknown>,
	expectedSubstring: string,
): Promise<void> {
	let err: Error | undefined;
	try {
		await fn();
	} catch (e) {
		err = e as Error;
	}
	if (!err) throw new Error(`${label} did not revert; expected: ${expectedSubstring}`);
	expect(err.message, `${label}: revert message`).to.include(expectedSubstring);
}

// Send a contract call that is expected to revert. Handles both:
//   1. viem throws during simulation (eth_call) — caught and verified
//   2. viem sends tx without throwing — receipt status checked for "reverted"
export async function expectTxReverts(
	signer: Awaited<ReturnType<typeof hre.viem.getWalletClients>>[number],
	params: { address: Hex; abi: readonly unknown[]; functionName: string; args: readonly unknown[] },
	expectedSubstring?: string,
): Promise<void> {
	const publicClient = await hre.viem.getPublicClient();
	let hash: Hex | undefined;
	try {
		hash = await signer.writeContract({
			address: params.address,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem's overloaded writeContract is hard to type generically
			abi: params.abi as any,
			functionName: params.functionName,
			args: params.args,
			gas: 5_000_000n,
		});
	} catch (e: unknown) {
		const msg = (e as Error).message;
		if (expectedSubstring) {
			expect(msg).to.include(expectedSubstring);
		}
		return;
	}
	// Tx accepted at simulation; check the receipt for revert.
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	expect(receipt.status).to.equal("reverted", `expected ${params.functionName} to revert`);
}
