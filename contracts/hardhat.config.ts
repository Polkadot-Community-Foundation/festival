import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";
import "@parity/hardhat-polkadot";

// Hardhat compiles the existing Solidity sources in `src/` via resolc and runs
// tests against a real revive ETH-RPC. The forge suite stays as the fast
// EVM-level logic check; this is the on-chain integration check.
//
// Hardhat's project root is this directory (contracts/). Tests, cache and
// artifacts are kept under e2e/ so they don't collide with foundry's own
// out/ + cache/ at this level.
const config: HardhatUserConfig = {
	// 0.8.28 to match OpenZeppelin v5.6.1's `^0.8.24` pragma; the festival
	// contracts themselves declare `^0.8.20` so they're fine with anything ≥0.8.20.
	// evmVersion: cancun matches foundry.toml so the resolc-emitted bytecode and
	// the forge-emitted bytecode are produced from the same Solidity flavor.
	solidity: {
		version: "0.8.28",
		settings: {
			evmVersion: "cancun",
			optimizer: { enabled: true, runs: 200 },
			viaIR: true,
		},
	},
	resolc: {
		version: "1.0.0",
	},
	paths: {
		sources: "src",
		tests: "e2e/test",
		cache: "e2e/cache",
		artifacts: "e2e/artifacts",
	},
	networks: {
		// Local revive dev-node (boot separately via 0xRVE/revive-solo's
		// scripts/start-node.sh + scripts/start-eth-rpc.sh, or any
		// pallet-revive node + eth-rpc adapter listening on 8545).
		local: {
			url: process.env.ETH_RPC_HTTP || "http://127.0.0.1:8545",
			// Moonbeam-style ECDSA dev keys (Alith / Baltathar / Charleth), prefunded
			// by `eth-rpc --dev`. These are NOT the Substrate Alice/Bob/Charlie sr25519
			// keys — those don't have a stable ECDSA derivation. Public test keys, NOT
			// secrets.
			accounts: [
				// Alith
				"0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133",
				// Baltathar
				"0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b",
				// Charleth
				"0x0b6e18cafb6ed99687ec547bd28139cafbd3a4f28014f8640076aba0082bf262",
			],
		},
		// Polkadot Hub TestNet (Paseo Asset Hub). Set PRIVATE_KEY in env to
		// run `npm run test:testnet` against a funded account on Paseo.
		polkadotTestnet: {
			url: "https://eth-rpc-testnet.polkadot.io/",
			chainId: 420420417,
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
		},
	},
};

export default config;
