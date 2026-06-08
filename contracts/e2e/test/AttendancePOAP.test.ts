// Smallest end-to-end test that proves the toolchain works:
//   - resolc compiles AttendancePOAP from contracts/src
//   - hardhat-viem deploys it against the configured network (revive)
//   - public state reads work (`factory()`, `isAuthorizedMinter(addr)`)
//   - state-changing tx works (`authorizeMinter`)
//   - role-gated revert works (`OnlyFactory`)
//
// Run:
//   npm run test            # against local revive node on :8545
//   npm run test:testnet    # against Polkadot Hub TestNet (requires PRIVATE_KEY)

import hre from "hardhat";
import { expect } from "chai";
import { getAddress } from "viem";

import { expectTxReverts, sendWithRetry } from "./helpers";

describe("AttendancePOAP — framework smoke test", function () {
	// Bigger timeout: real chains have block times measured in seconds.
	this.timeout(120_000);

	it("deploys, reads state, authorizes a minter, and rejects non-factory writes", async function () {
		const [deployer, otherAccount] = await hre.viem.getWalletClients();

		// Deployer is the factory.
		const poap = await hre.viem.deployContract("AttendancePOAP", [deployer.account.address]);

		// View call: factory should match.
		expect(getAddress(await poap.read.factory())).to.equal(getAddress(deployer.account.address));

		// View call: a random address is NOT yet authorized.
		expect(await poap.read.isAuthorizedMinter([otherAccount.account.address])).to.equal(false);

		// Write call: factory authorizes a minter. `write.X` resolves with the tx
		// hash, not the receipt — wait for inclusion before reading state back.
		await sendWithRetry("authorizeMinter", () =>
			poap.write.authorizeMinter([otherAccount.account.address]),
		);
		expect(await poap.read.isAuthorizedMinter([otherAccount.account.address])).to.equal(true);

		// Revert path: a non-factory caller cannot authorize.
		const thirdParty = (await hre.viem.getWalletClients())[2];
		await expectTxReverts(
			otherAccount,
			{
				address: poap.address,
				abi: poap.abi,
				functionName: "authorizeMinter",
				args: [thirdParty.account.address],
			},
			"OnlyFactory",
		);
	});
});
