// Slim Multicall3 suite running on a real revive node.
//
// The forge suite (../../test/protocols/Multicall3.t.sol) runs the same
// contract against revm — that proves the Solidity is correct. This suite
// proves pallet-revive's PolkaVM execution behaves the same way for the
// inline-assembly revert paths in aggregate / aggregate3 / aggregate3Value,
// which are the parts most likely to surface translation bugs.
//
// Coverage is intentionally narrow: happy + revert paths for each of the
// three aggregate variants. Pure block-introspection helpers
// (getBlockNumber, getCurrentBlockTimestamp, etc.) are validated upstream
// in mds1/multicall3.

import hre from "hardhat";
import { expect } from "chai";
import { encodeFunctionData, toFunctionSelector, type Address, type Hex } from "viem";

import { expectThrows, waitForNextBlock } from "./helpers";

describe("Multicall3 on revive — inline-assembly revert paths", function () {
	this.timeout(180_000);

	let multicallAddress: Address;
	let multicallAbi: readonly unknown[];
	let calleeAddress: Address;
	let calleeAbi: readonly unknown[];
	let etherSinkAddress: Address;

	before(async function () {
		// Ensure head is comfortably past genesis so head - 1n is safe in every
		// test below. blockhash(0) is implementation-defined.
		const client = await hre.viem.getPublicClient();
		while ((await client.getBlockNumber()) < 5n) {
			await waitForNextBlock();
		}
		const multicall = await hre.viem.deployContract("Multicall3");
		const callee = await hre.viem.deployContract("MockCallee");
		const etherSink = await hre.viem.deployContract("EtherSink");
		multicallAddress = multicall.address;
		multicallAbi = multicall.abi;
		calleeAddress = callee.address;
		calleeAbi = callee.abi;
		etherSinkAddress = etherSink.address;
	});

	function call(fn: string, args: unknown[] = []): Hex {
		return encodeFunctionData({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem ABI type is structurally complex
			abi: calleeAbi as any,
			functionName: fn,
			args,
		});
	}

	it("aggregate — happy path returns a block number and the requested block hash", async function () {
		const client = await hre.viem.getPublicClient();
		const head = await client.getBlockNumber();
		// Query head - 1 so revive's BLOCKHASH path runs against a past (i.e. real)
		// block — BLOCKHASH(currentBlock) returns 0, which would make the assertion
		// vacuous and risk flake against eth_call timing.
		const target = head - 1n;
		const expected = (await client.getBlock({ blockNumber: target })).hash;
		const result = (await client.readContract({
			address: multicallAddress,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem ABI type is structurally complex
			abi: multicallAbi as any,
			functionName: "aggregate",
			args: [[{ target: calleeAddress, callData: call("getBlockHash", [target]) }]],
		})) as [bigint, Hex[]];
		const [returnedBlockNumber, returnData] = result;
		expect(returnedBlockNumber >= head, `returned ${returnedBlockNumber} >= head ${head}`).to.equal(true);
		// returnData[0] is bytes32 returned bare (no length prefix); compare raw.
		expect(returnData[0].toLowerCase()).to.equal(expected.toLowerCase());
	});

	it("aggregate — reverts with 'call failed' when a sub-call reverts", async function () {
		const client = await hre.viem.getPublicClient();
		const head = await client.getBlockNumber();
		await expectThrows(
			"aggregate",
			() =>
				client.readContract({
					address: multicallAddress,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem ABI type is structurally complex
					abi: multicallAbi as any,
					functionName: "aggregate",
					args: [[
						{ target: calleeAddress, callData: call("getBlockHash", [head]) },
						{ target: calleeAddress, callData: call("thisMethodReverts") },
					]],
				}),
			"Multicall3: call failed",
		);
	});

	it("aggregate3 — allowFailure=true captures the Unsuccessful() selector and the requested block hash", async function () {
		const client = await hre.viem.getPublicClient();
		const head = await client.getBlockNumber();
		const target = head - 1n;
		const expected = (await client.getBlock({ blockNumber: target })).hash;
		const result = (await client.readContract({
			address: multicallAddress,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem ABI type is structurally complex
			abi: multicallAbi as any,
			functionName: "aggregate3",
			args: [[
				{ target: calleeAddress, allowFailure: false, callData: call("getBlockHash", [target]) },
				{ target: calleeAddress, allowFailure: true, callData: call("thisMethodReverts") },
			]],
		})) as Array<{ success: boolean; returnData: Hex }>;
		expect(result[0].success, "first call should succeed").to.equal(true);
		expect(result[0].returnData.toLowerCase(), "first call returned the requested block hash").to.equal(
			expected.toLowerCase(),
		);
		expect(result[1].success, "second call should be allowed-failure").to.equal(false);
		expect(result[1].returnData.toLowerCase(), "captured Unsuccessful() selector").to.equal(
			toFunctionSelector("Unsuccessful()").toLowerCase(),
		);
	});

	it("aggregate3 — allowFailure=false on a reverting call → whole tx reverts", async function () {
		const client = await hre.viem.getPublicClient();
		const head = await client.getBlockNumber();
		await expectThrows(
			"aggregate3",
			() =>
				client.readContract({
					address: multicallAddress,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem ABI type is structurally complex
					abi: multicallAbi as any,
					functionName: "aggregate3",
					args: [[
						{ target: calleeAddress, allowFailure: false, callData: call("getBlockHash", [head]) },
						{ target: calleeAddress, allowFailure: false, callData: call("thisMethodReverts") },
					]],
				}),
			"Multicall3: call failed",
		);
	});

	it("aggregate3Value — claimed value > sent value → 'value mismatch' revert", async function () {
		const client = await hre.viem.getPublicClient();
		await expectThrows(
			"aggregate3Value",
			() =>
				client.readContract({
					address: multicallAddress,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem ABI type is structurally complex
					abi: multicallAbi as any,
					functionName: "aggregate3Value",
					args: [[
						{
							target: calleeAddress,
							allowFailure: true,
							value: 1n,
							callData: call("sendBackValue", [etherSinkAddress]),
						},
					]],
					// readContract does not send value, so claimed (1) != sent (0).
				}),
			"Multicall3: value mismatch",
		);
	});
});
