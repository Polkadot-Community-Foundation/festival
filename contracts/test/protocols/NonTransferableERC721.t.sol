// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/protocols/nontransferable/NonTransferableERC721.sol";

/// @dev Concrete implementation for testing the abstract NonTransferableERC721
contract MockNonTransferable is NonTransferableERC721 {
    uint256 private _nextTokenId = 1;

    constructor() NonTransferableERC721("Mock NonTransferable", "MNT") {}

    function mint(address to) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }
}

contract NonTransferableERC721Test is Test {
    MockNonTransferable public nft;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        nft = new MockNonTransferable();
    }

    function testMintSucceeds() public {
        uint256 tokenId = nft.mint(alice);
        assertEq(nft.ownerOf(tokenId), alice);
        assertEq(nft.balanceOf(alice), 1);
        assertEq(tokenId, 1);
    }

    function testBurnSucceeds() public {
        uint256 tokenId = nft.mint(alice);
        nft.burn(tokenId);
        assertEq(nft.balanceOf(alice), 0);
    }

    function testTransferFromReverts() public {
        uint256 tokenId = nft.mint(alice);

        vm.prank(alice);
        vm.expectRevert(NonTransferableERC721.TransferNotAllowed.selector);
        nft.transferFrom(alice, bob, tokenId);
    }

    function testSafeTransferFromReverts() public {
        uint256 tokenId = nft.mint(alice);

        vm.prank(alice);
        vm.expectRevert(NonTransferableERC721.TransferNotAllowed.selector);
        nft.safeTransferFrom(alice, bob, tokenId);
    }
}
