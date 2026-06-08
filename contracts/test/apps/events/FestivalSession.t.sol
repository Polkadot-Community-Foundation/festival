// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../../src/apps/events/Festival.sol";
import "../../../src/apps/events/FestivalSession.sol";
import "../../../src/protocols/poap/AttendancePOAP.sol";

contract FestivalSessionTest is Test {
    AttendancePOAP public festivalPoap;
    AttendancePOAP public sessionPoap;
    Festival public festival;
    FestivalSession public session;
    address public creator = makeAddr("creator");
    address public subCreator = makeAddr("subCreator");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public unauthorized = makeAddr("unauthorized");

    bytes32 constant CID = bytes32(uint256(0xDEADBEEF));
    bytes32 constant CHANNEL_CID = bytes32(uint256(0xC4A4));
    uint64 constant START = 1700000000;
    uint64 constant END = 1700100000;

    function setUp() public {
        vm.warp(START - 1000);

        festivalPoap = new AttendancePOAP(address(this));
        sessionPoap = new AttendancePOAP(address(this));

        // Deploy festival
        festival = new Festival(
            creator,
            address(festivalPoap),
            address(sessionPoap),
            true // sessionsEnabled
        );

        // Wire POAP contracts, then configure
        festivalPoap.authorizeMinter(address(festival));
        sessionPoap.transferFactory(address(festival));

        vm.prank(creator);
        festival.setup(CID, CHANNEL_CID, START, END, 100);

        // Register and check in subCreator so they get a POAP
        vm.prank(subCreator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(subCreator);
        uint256 subCreatorPoapToken = 1;

        // Create a sub-event
        vm.prank(subCreator);
        address sAddr = festival.createSession(
            CID, START + 1000, END - 1000, subCreatorPoapToken
        );
        session = FestivalSession(payable(sAddr));
    }

    function testParentFestival() public view {
        assertEq(session.parentFestival(), address(festival));
    }

    function testCreatorHasAllRoles() public view {
        assertTrue(session.hasRole(session.DEFAULT_ADMIN_ROLE(), subCreator));
        assertTrue(session.hasRole(session.MANAGER_ROLE(), subCreator));
        assertTrue(session.hasRole(session.VOLUNTEER_ROLE(), subCreator));
    }

    // --- Registration ---

    function testRegister() public {
        vm.prank(alice);
        session.register();
        assertTrue(session.isRegistered(alice));
        assertEq(session.registeredCount(), 1);
    }

    function testRegisterAlreadyRegisteredReverts() public {
        vm.startPrank(alice);
        session.register();
        vm.expectRevert(FestivalSession.AlreadyRegistered.selector);
        session.register();
        vm.stopPrank();
    }

    // --- Check-in ---

    /// @dev Register + check in `attendee` on the festival, prerequisite for session check-in.
    function _festivalCheckIn(address attendee) internal {
        vm.prank(attendee);
        festival.register();
        vm.prank(creator);
        festival.checkIn(attendee);
    }

    function testCheckIn() public {
        _festivalCheckIn(alice);
        vm.prank(alice);
        session.register();

        vm.prank(subCreator);
        session.checkIn(alice);

        assertTrue(session.isCheckedIn(alice));
    }

    function testCheckInMintsSessionPoap() public {
        _festivalCheckIn(alice);
        vm.prank(alice);
        session.register();

        vm.prank(subCreator);
        session.checkIn(alice);

        assertEq(sessionPoap.balanceOf(alice), 1);
    }

    function testCheckInNotRegisteredReverts() public {
        _festivalCheckIn(alice);
        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.NotRegistered.selector);
        session.checkIn(alice);
    }

    function testCheckInWithoutFestivalCheckInReverts() public {
        // alice has not been festival-checked-in.
        vm.prank(alice);
        session.register();

        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.FestivalCheckInRequired.selector);
        session.checkIn(alice);
    }

    // --- Manual Check-in ---

    function testManualCheckIn() public {
        _festivalCheckIn(alice);
        vm.prank(subCreator);
        session.manualCheckIn(alice);

        assertTrue(session.isRegistered(alice));
        assertTrue(session.isCheckedIn(alice));
    }

    function testManualCheckInWithoutFestivalCheckInReverts() public {
        // alice has no festival POAP; manualCheckIn must reject even though it would
        // otherwise auto-register her on the session.
        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.FestivalCheckInRequired.selector);
        session.manualCheckIn(alice);
    }

    // --- Cancel ---

    function testCancel() public {
        vm.prank(subCreator);
        festival.cancelSession(address(session));
        assertTrue(session.cancelled());
    }

    function testCancelBlocksRegister() public {
        vm.prank(subCreator);
        festival.cancelSession(address(session));

        vm.prank(alice);
        vm.expectRevert(FestivalSession.IsCancelled.selector);
        session.register();
    }

    function testDirectCancelReverts() public {
        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.NotAuthorized.selector);
        session.cancel();
    }

    // --- UpdateCid ---

    function testUpdateCid() public {
        bytes32 newCid = bytes32(uint256(0xCAFE));
        vm.prank(subCreator);
        session.updateCid(newCid);
        assertEq(session.metadataCid(), newCid);
    }

    function testUpdateCidByAdminOnly() public {
        // alice has only DEFAULT_ADMIN_ROLE on the session (no MANAGER_ROLE).
        bytes32 adminRole = session.DEFAULT_ADMIN_ROLE();
        vm.prank(subCreator);
        session.grantRole(adminRole, alice);

        bytes32 newCid = bytes32(uint256(0xCAFE));
        vm.prank(alice);
        session.updateCid(newCid);
        assertEq(session.metadataCid(), newCid);
    }

    function testUpdateCidByManagerOnly() public {
        bytes32 managerRole = session.MANAGER_ROLE();
        vm.prank(subCreator);
        session.grantRole(managerRole, alice);

        bytes32 newCid = bytes32(uint256(0xBEEF));
        vm.prank(alice);
        session.updateCid(newCid);
        assertEq(session.metadataCid(), newCid);
    }

    function testUpdateCidByVolunteerOnlyReverts() public {
        bytes32 volunteerRole = session.VOLUNTEER_ROLE();
        vm.prank(subCreator);
        session.grantRole(volunteerRole, alice);

        vm.prank(alice);
        vm.expectRevert();
        session.updateCid(bytes32(uint256(0xDEAD)));
    }

    function testUpdateCidUnauthorizedReverts() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        session.updateCid(bytes32(0));
    }

    function testUpdateCidZeroReverts() public {
        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.MissingMetadata.selector);
        session.updateCid(bytes32(0));
    }

    // --- getEventDetails ---

    function testGetEventDetails() public view {
        (
            bytes32 cid, address c, address poapAddr, address parent,
            uint64 st, uint64 et,
            bool can, uint256 rc
        ) = session.getEventDetails();

        assertEq(cid, CID);
        assertEq(c, subCreator);
        assertEq(poapAddr, address(sessionPoap));
        assertEq(parent, address(festival));
        assertEq(st, START + 1000);
        assertEq(et, END - 1000);
        assertFalse(can);
        assertEq(rc, 0);
    }

    // --- Creator Auto-Check-In ---

    function testSubCreatorAutoCheckedIn() public view {
        assertTrue(session.isRegistered(subCreator));
        assertTrue(session.isCheckedIn(subCreator));
        assertEq(session.ticketOf(subCreator), type(uint256).max);
        assertEq(session.registeredCount(), 0); // creator excluded
    }

    function testSubCreatorHasPoap() public view {
        assertEq(sessionPoap.balanceOf(subCreator), 1);
    }

    function testSubCreatorCannotRegisterAgain() public {
        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.AlreadyRegistered.selector);
        session.register();
    }

    // --- Flag ---

    /// @dev Register + check in `attendee` on the festival, returning their festival POAP token id.
    function _checkInAndGetPoap(address attendee) internal returns (uint256 tokenId) {
        vm.prank(attendee);
        festival.register();
        vm.prank(creator);
        festival.checkIn(attendee);
        uint256[] memory tokens = festivalPoap.getTokensBySource(address(festival));
        tokenId = tokens[tokens.length - 1];
    }

    function testFlagHappyPath() public {
        uint256 aliceToken = _checkInAndGetPoap(alice);

        vm.prank(alice);
        session.flag(aliceToken);

        assertEq(session.flagCount(), 1);
        assertTrue(session.hasFlagged(alice));
    }

    function testFlagEmitsEvent() public {
        uint256 aliceToken = _checkInAndGetPoap(alice);

        vm.expectEmit(true, false, false, true, address(session));
        emit FestivalSession.SessionFlagged(alice, 1);
        vm.prank(alice);
        session.flag(aliceToken);
    }

    function testFlagWithoutFestivalPoapReverts() public {
        // bob has no festival POAP
        vm.prank(bob);
        vm.expectRevert();
        session.flag(999); // nonexistent token
    }

    function testFlagWithSomeoneElsePoapReverts() public {
        uint256 aliceToken = _checkInAndGetPoap(alice);

        // bob attempts to flag using alice's token
        vm.prank(bob);
        vm.expectRevert(FestivalSession.NotFestivalPoapHolder.selector);
        session.flag(aliceToken);
    }

    function testFlagSelfReverts() public {
        // subCreator is the session creator; their festival POAP is token 1.
        vm.prank(subCreator);
        vm.expectRevert(FestivalSession.CannotFlagOwnSession.selector);
        session.flag(1);
    }

    function testFlagDoubleReverts() public {
        uint256 aliceToken = _checkInAndGetPoap(alice);

        vm.prank(alice);
        session.flag(aliceToken);

        vm.prank(alice);
        vm.expectRevert(FestivalSession.AlreadyFlagged.selector);
        session.flag(aliceToken);
    }

    function testFlagAfterCancelReverts() public {
        uint256 aliceToken = _checkInAndGetPoap(alice);

        // Session creator cancels (below threshold path)
        vm.prank(subCreator);
        festival.cancelSession(address(session));

        vm.prank(alice);
        vm.expectRevert(FestivalSession.IsCancelled.selector);
        session.flag(aliceToken);
    }

    function testFlagThresholdExposed() public view {
        assertEq(session.FLAG_THRESHOLD(), 5);
    }

    function testFlagAccumulates() public {
        address[5] memory flaggers = [
            makeAddr("f1"),
            makeAddr("f2"),
            makeAddr("f3"),
            makeAddr("f4"),
            makeAddr("f5")
        ];
        for (uint256 i = 0; i < flaggers.length; i++) {
            uint256 t = _checkInAndGetPoap(flaggers[i]);
            vm.prank(flaggers[i]);
            session.flag(t);
            assertEq(session.flagCount(), i + 1);
        }
        assertEq(session.flagCount(), session.FLAG_THRESHOLD());
    }

    // --- Enumerable Roles ---

    function testGetRoleMemberCount() public view {
        assertEq(session.getRoleMemberCount(session.DEFAULT_ADMIN_ROLE()), 1);
        assertEq(session.getRoleMemberCount(session.MANAGER_ROLE()), 1);
    }

    function testGetRoleMembers() public {
        bytes32 volunteerRole = keccak256("VOLUNTEER_ROLE");

        vm.prank(subCreator);
        session.grantRole(volunteerRole, alice);

        assertEq(session.getRoleMemberCount(volunteerRole), 2);
        assertEq(session.getRoleMember(volunteerRole, 0), subCreator);
        assertEq(session.getRoleMember(volunteerRole, 1), alice);
    }
}
