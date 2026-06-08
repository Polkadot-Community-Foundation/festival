// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Vendored from mds1/multicall3: src/test/mocks/MockCallee.sol.
// Lives under src/ so both forge (test/protocols/Multicall3.t.sol) and
// hardhat (e2e/test/Multicall3.test.ts) can deploy it.

/// @title MockCallee
/// @notice Receives calls from the Multicaller
/// @author andreas@nascent.xyz
contract MockCallee {

  /// @notice Failure
  error Unsuccessful();

  /// @notice Returns the block hash for the given block number
  /// @param blockNumber The block number
  /// @return blockHash The 32 byte block hash
  function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash) {
    blockHash = blockhash(blockNumber);
  }

  /// @notice Reverts o______O
  function thisMethodReverts() public pure {
    revert Unsuccessful();
  }

  /// @notice Accepts a value
  function sendBackValue(address target) public payable {
    (bool ok, ) = target.call{value: msg.value}("");
    if (!ok) revert Unsuccessful();
  }
}
