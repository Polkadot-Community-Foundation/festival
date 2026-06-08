// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/apps/events/Festival.sol";
import "../../src/apps/events/FestivalSession.sol";
import "../../src/protocols/poap/AttendancePOAP.sol";

contract FestivalIntegrationTest is Test {
    AttendancePOAP public festivalPoap;
    AttendancePOAP public sessionPoap;
    address public creator = makeAddr("creator");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public staff = makeAddr("staff");

    bytes32 constant CID = bytes32(uint256(0xDEADBEEF));
    bytes32 constant CHANNEL_CID = bytes32(uint256(0xC4A4));
    uint64 constant START = 1700000000;
    uint64 constant END = 1700100000;

    function setUp() public {
        vm.warp(START - 1000);
        festivalPoap = new AttendancePOAP(address(this));
        sessionPoap = new AttendancePOAP(address(this));
    }

    /// @dev Deploys a festival with the standard wiring sequence.
    function _deployFestival(
        address _creator,
        bytes32 _cid,
        uint32 _capacity,
        uint64 _start,
        uint64 _end,
        bool _subEventsEnabled
    ) internal returns (Festival) {
        Festival f = new Festival(
            _creator,
            address(festivalPoap),
            address(sessionPoap),
            _subEventsEnabled
        );
        festivalPoap.authorizeMinter(address(f));
        sessionPoap.transferFactory(address(f));
        vm.prank(_creator);
        f.setup(_cid, CHANNEL_CID, _start, _end, _capacity);
        return f;
    }

    // 1. Full lifecycle: deploy → festival → register → checkIn → POAP
    function testFullLifecycle() public {
        Festival fest = _deployFestival(creator, CID, 100, START, END, true);

        // Register two attendees
        vm.prank(alice);
        fest.register();
        vm.prank(bob);
        fest.register();

        // Check in both
        vm.startPrank(creator);
        fest.checkIn(alice);
        fest.checkIn(bob);
        vm.stopPrank();

        // Both have POAPs
        assertEq(festivalPoap.balanceOf(alice), 1);
        assertEq(festivalPoap.balanceOf(bob), 1);
    }

    // 2. Sub-event lifecycle
    function testSessionLifecycle() public {
        Festival fest = _deployFestival(creator, CID, 100, START, END, true);

        // Creator registers and checks in to get POAP
        vm.prank(creator);
        fest.register();
        vm.prank(creator);
        fest.checkIn(creator);
        uint256 creatorPoapToken = 1;

        // Create sub-event
        vm.prank(creator);
        address sAddr = fest.createSession(CID, START + 1000, END - 1000, creatorPoapToken);
        FestivalSession sub = FestivalSession(payable(sAddr));

        // Alice must be festival-checked-in before she can be checked in to a session.
        vm.prank(alice);
        fest.register();
        vm.prank(creator);
        fest.checkIn(alice);

        // Register and check in on sub-event
        vm.prank(alice);
        sub.register();

        vm.prank(creator);
        sub.checkIn(alice);

        // Sub-event POAP minted
        assertEq(sessionPoap.balanceOf(alice), 1);
    }

    // 3. Manual check-in path
    function testManualCheckInPath() public {
        Festival fest = _deployFestival(creator, CID, 100, START, END, false);

        // Manual check-in (not registered yet)
        vm.prank(creator);
        fest.manualCheckIn(alice);

        assertTrue(fest.isRegistered(alice));
        assertTrue(fest.isCheckedIn(alice));
    }

    // 4. Role-based access
    function testRoleBasedAccess() public {
        Festival fest = _deployFestival(creator, CID, 100, START, END, false);

        // Grant CHECK_IN role to staff
        vm.startPrank(creator);
        fest.grantRole(fest.VOLUNTEER_ROLE(), staff);
        vm.stopPrank();

        // Register
        vm.prank(alice);
        fest.register();

        // Staff can check in
        vm.prank(staff);
        fest.checkIn(alice);

        // Manager can update CID
        vm.prank(creator);
        fest.updateCid(bytes32(uint256(0xCAFE)));
    }

    // 5. POAP-gated sub-event creation
    function testPoapGatedSessionCreation() public {
        Festival fest = _deployFestival(creator, CID, 100, START, END, true);

        // Alice registers and checks in → gets POAP
        vm.prank(alice);
        fest.register();
        vm.prank(creator);
        fest.checkIn(alice);

        // Alice → POAP token 1 (no creator auto-check-in)
        uint256 aliceToken = 1;

        // Alice can create sub-event with her POAP token
        vm.prank(alice);
        fest.createSession(CID, START, END, aliceToken);

        // Bob has no POAP → reverts (token 999 doesn't exist)
        vm.prank(bob);
        vm.expectRevert();
        fest.createSession(CID, START, END, 999);
    }

    // 6. Cancellation blocks all mutations
    function testCancellationBlocksAll() public {
        Festival fest = _deployFestival(creator, CID, 100, START, END, true);

        vm.prank(creator);
        fest.cancel();

        vm.prank(alice);
        vm.expectRevert(Festival.IsCancelled.selector);
        fest.register();

        vm.prank(creator);
        vm.expectRevert(Festival.IsCancelled.selector);
        fest.checkIn(alice);

        vm.prank(creator);
        vm.expectRevert(Festival.IsCancelled.selector);
        fest.manualCheckIn(alice);

        vm.prank(creator);
        vm.expectRevert(Festival.IsCancelled.selector);
        fest.createSession(CID, START, END, 0);
    }
}
