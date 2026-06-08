// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/protocols/poap/AttendancePOAP.sol";

contract AttendancePOAPTest is Test {
    AttendancePOAP public poap;
    address public factory;
    address public minter = makeAddr("minter");
    address public minter2 = makeAddr("minter2");
    address public unauthorized = makeAddr("unauthorized");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    function setUp() public {
        factory = address(this);
        poap = new AttendancePOAP(factory);
    }

    // --- Authorization ---

    function testAuthorizeMinter() public {
        vm.expectEmit(true, false, false, false);
        emit IAttendancePOAP.MinterAuthorized(minter);
        poap.authorizeMinter(minter);

        assertTrue(poap.isAuthorizedMinter(minter));
    }

    function testAuthorizeMinterOnlyFactory() public {
        vm.prank(unauthorized);
        vm.expectRevert(IAttendancePOAP.OnlyFactory.selector);
        poap.authorizeMinter(minter);
    }

    function testAuthorizeMinterAlreadyAuthorized() public {
        poap.authorizeMinter(minter);

        vm.expectRevert(IAttendancePOAP.AlreadyAuthorized.selector);
        poap.authorizeMinter(minter);
    }

    function testRevokeMinter() public {
        poap.authorizeMinter(minter);

        vm.expectEmit(true, false, false, false);
        emit IAttendancePOAP.MinterRevoked(minter);
        poap.revokeMinter(minter);

        assertFalse(poap.isAuthorizedMinter(minter));
    }

    function testRevokeMinterNotAuthorized() public {
        vm.expectRevert(IAttendancePOAP.NotAuthorized.selector);
        poap.revokeMinter(minter);
    }

    // --- Factory Management ---

    function testTransferFactory() public {
        address newFactory = makeAddr("newFactory");
        poap.transferFactory(newFactory);
        assertEq(poap.factory(), newFactory);
    }

    function testTransferFactoryOnlyFactory() public {
        vm.prank(unauthorized);
        vm.expectRevert(IAttendancePOAP.OnlyFactory.selector);
        poap.transferFactory(unauthorized);
    }

    function testRenounceFactory() public {
        poap.renounceFactory();
        assertEq(poap.factory(), address(0));

        // No further factory operations possible
        vm.expectRevert(IAttendancePOAP.OnlyFactory.selector);
        poap.authorizeMinter(minter);
    }

    function testRenounceFactoryOnlyFactory() public {
        vm.prank(unauthorized);
        vm.expectRevert(IAttendancePOAP.OnlyFactory.selector);
        poap.renounceFactory();
    }

    // --- Minting ---

    function testMintPOAPStartsAt1() public {
        poap.authorizeMinter(minter);

        vm.prank(minter);
        uint256 tokenId = poap.mintPOAP(alice, minter);
        assertEq(tokenId, 1); // Token ID 0 is reserved sentinel
    }

    function testMintPOAP() public {
        poap.authorizeMinter(minter);

        vm.prank(minter);
        vm.expectEmit(true, true, true, false);
        emit IAttendancePOAP.POAPMinted(1, alice, minter);
        uint256 tokenId = poap.mintPOAP(alice, minter);

        assertEq(tokenId, 1);
        assertEq(poap.ownerOf(tokenId), alice);
        assertEq(poap.balanceOf(alice), 1);
    }

    function testOnlyAuthorizedMinterCanMint() public {
        vm.prank(unauthorized);
        vm.expectRevert(IAttendancePOAP.OnlyAuthorizedMinter.selector);
        poap.mintPOAP(alice, unauthorized);
    }

    function testPOAPDataStored() public {
        poap.authorizeMinter(minter);

        vm.prank(minter);
        uint256 tokenId = poap.mintPOAP(alice, minter);

        IAttendancePOAP.POAPData memory data = poap.getPOAPData(tokenId);
        assertEq(data.sourceContract, minter);
        assertEq(data.attendee, alice);
        assertEq(data.issuedAt, uint64(block.timestamp));
    }

    function testPOAPIsSoulbound() public {
        poap.authorizeMinter(minter);

        vm.prank(minter);
        uint256 tokenId = poap.mintPOAP(alice, minter);

        vm.prank(alice);
        vm.expectRevert(NonTransferableERC721.TransferNotAllowed.selector);
        poap.transferFrom(alice, bob, tokenId);
    }

    function testMultiplePOAPs() public {
        poap.authorizeMinter(minter);

        vm.startPrank(minter);
        uint256 token1 = poap.mintPOAP(alice, minter);
        uint256 token2 = poap.mintPOAP(bob, minter);
        vm.stopPrank();

        assertEq(token1, 1);
        assertEq(token2, 2);
        assertEq(poap.balanceOf(alice), 1);
        assertEq(poap.balanceOf(bob), 1);
    }

    // --- Source Index ---

    function testGetTokensBySource() public {
        poap.authorizeMinter(minter);
        poap.authorizeMinter(minter2);

        vm.prank(minter);
        uint256 t1 = poap.mintPOAP(alice, minter);
        vm.prank(minter);
        uint256 t2 = poap.mintPOAP(bob, minter);
        vm.prank(minter2);
        poap.mintPOAP(charlie, minter2);

        uint256[] memory tokens = poap.getTokensBySource(minter);
        assertEq(tokens.length, 2);
        assertEq(tokens[0], t1);
        assertEq(tokens[1], t2);

        uint256[] memory tokens2 = poap.getTokensBySource(minter2);
        assertEq(tokens2.length, 1);
    }

}
