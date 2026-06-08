// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Vendored from mds1/multicall3: src/test/mocks/EtherSink.sol.
// Lives under src/ so both forge (test/protocols/Multicall3.t.sol) and
// hardhat (e2e/test/Multicall3.test.ts) can deploy it.

/// @title EtherSink
/// @notice Receives Ether, that's about it \( o_o )/
/// @author andreas@nascent.xyz
contract EtherSink {

  /// >>>>>>>>>>>>>>>>>>>>>>  ACCEPT CALLS  <<<<<<<<<<<<<<<<<<<<<<< ///

  /// @notice Allows the test to receive eth via low level calls
  receive() external payable {}
}
