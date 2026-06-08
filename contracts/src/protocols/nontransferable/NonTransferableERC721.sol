// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title NonTransferableERC721: Non-transferable NFT base
/// @notice Abstract contract that makes any ERC-721 non-transferable.
/// Tokens can be minted and burned but never transferred between accounts.
abstract contract NonTransferableERC721 is ERC721 {
    error TransferNotAllowed();

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {}

    /// @dev Override _update to block transfers. Allow mint (from==0) and burn (to==0).
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert TransferNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }
}
