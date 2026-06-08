// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../../src/apps/events/Festival.sol";
import "../../../src/protocols/poap/AttendancePOAP.sol";

contract FestivalTest is Test {
    AttendancePOAP public festivalPoap;
    AttendancePOAP public sessionPoap;
    Festival public festival;
    address public creator = makeAddr("creator");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public staff = makeAddr("staff");
    address public unauthorized = makeAddr("unauthorized");

    bytes32 constant CID = bytes32(uint256(0xDEADBEEF));
    bytes32 constant CHANNEL_CID = bytes32(uint256(0xC4A4));
    uint32 constant CAPACITY = 100;
    uint64 constant START = 1700000000;
    uint64 constant END = 1700100000;

    function setUp() public {
        vm.warp(START - 1000);

        festivalPoap = new AttendancePOAP(address(this));
        sessionPoap = new AttendancePOAP(address(this));

        festival = new Festival(
            creator,
            address(festivalPoap),
            address(sessionPoap),
            true // subEventsEnabled
        );

        // Configure via setup()
        festivalPoap.authorizeMinter(address(festival));
        sessionPoap.transferFactory(address(festival));

        vm.prank(creator);
        festival.setup(CID, CHANNEL_CID, START, END, CAPACITY);
    }

    /// @dev Deploy an auxiliary festival for tests that don't need sub-event creation.
    function _deploySimpleFestival(
        address _creator,
        uint32 _capacity
    ) internal returns (Festival) {
        Festival f = new Festival(
            _creator,
            address(festivalPoap),
            address(sessionPoap),
            false // subEventsEnabled
        );
        festivalPoap.authorizeMinter(address(f));
        vm.prank(_creator);
        f.setup(CID, CHANNEL_CID, START, END, _capacity);
        return f;
    }

    // --- Setup ---

    function testSetupHappyPath() public view {
        assertEq(festival.metadataCid(), CID);
        assertEq(festival.startTime(), START);
        assertEq(festival.endTime(), END);
        assertEq(festival.capacity(), CAPACITY);
    }

    function testSetupAlreadyConfiguredReverts() public {
        vm.prank(creator);
        vm.expectRevert(Festival.AlreadyConfigured.selector);
        festival.setup(CID, CHANNEL_CID, START, END, 50);
    }

    function testSetupOnlyAdmin() public {
        Festival f = new Festival(creator, address(festivalPoap), address(sessionPoap), false);
        vm.prank(unauthorized);
        vm.expectRevert();
        f.setup(CID, CHANNEL_CID, START, END, 50);
    }

    function testSetupInvalidTimeRangeReverts() public {
        Festival f = new Festival(creator, address(festivalPoap), address(sessionPoap), false);
        festivalPoap.authorizeMinter(address(f));

        // endTime == startTime
        vm.prank(creator);
        vm.expectRevert(Festival.InvalidTimeRange.selector);
        f.setup(CID, CHANNEL_CID, START, START, 50);
    }

    function testSetupStoresChannelCidAndEmits() public {
        // setUp already ran setup() with CHANNEL_CID. Verify state + that the
        // ChannelMetadataUpdated event was emitted for a fresh deploy.
        assertEq(festival.channelMetadataCid(), CHANNEL_CID);

        Festival f = new Festival(creator, address(festivalPoap), address(sessionPoap), false);
        festivalPoap.authorizeMinter(address(f));

        vm.expectEmit(false, false, false, true, address(f));
        emit Festival.ChannelMetadataUpdated(CHANNEL_CID);
        vm.prank(creator);
        f.setup(CID, CHANNEL_CID, START, END, 50);
    }

    function testSetupMissingChannelCidReverts() public {
        Festival f = new Festival(creator, address(festivalPoap), address(sessionPoap), false);
        festivalPoap.authorizeMinter(address(f));

        vm.prank(creator);
        vm.expectRevert(Festival.MissingChannelMetadata.selector);
        f.setup(CID, bytes32(0), START, END, 50);
    }

    function testSetupMissingMetadataCidReverts() public {
        Festival f = new Festival(creator, address(festivalPoap), address(sessionPoap), false);
        festivalPoap.authorizeMinter(address(f));

        vm.prank(creator);
        vm.expectRevert(Festival.MissingMetadata.selector);
        f.setup(bytes32(0), CHANNEL_CID, START, END, 50);
    }

    // --- UpdateChannelMetadataCid ---

    function testUpdateChannelMetadataCidByManager() public {
        bytes32 newCid = bytes32(uint256(0xC1));
        vm.expectEmit(false, false, false, true, address(festival));
        emit Festival.ChannelMetadataUpdated(newCid);
        vm.prank(creator);
        festival.updateChannelMetadataCid(newCid);
        assertEq(festival.channelMetadataCid(), newCid);
    }

    function testUpdateChannelMetadataCidByAdminOnly() public {
        bytes32 adminRole = festival.DEFAULT_ADMIN_ROLE();
        vm.prank(creator);
        festival.grantRole(adminRole, staff);

        bytes32 newCid = bytes32(uint256(0xC2));
        vm.prank(staff);
        festival.updateChannelMetadataCid(newCid);
        assertEq(festival.channelMetadataCid(), newCid);
    }

    function testUpdateChannelMetadataCidByVolunteerReverts() public {
        bytes32 volunteerRole = festival.VOLUNTEER_ROLE();
        vm.prank(creator);
        festival.grantRole(volunteerRole, staff);

        vm.prank(staff);
        vm.expectRevert();
        festival.updateChannelMetadataCid(bytes32(uint256(0xC3)));
    }

    function testUpdateChannelMetadataCidUnauthorizedReverts() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        festival.updateChannelMetadataCid(bytes32(uint256(0xC4)));
    }

    function testUpdateChannelMetadataCidZeroReverts() public {
        vm.prank(creator);
        vm.expectRevert(Festival.MissingChannelMetadata.selector);
        festival.updateChannelMetadataCid(bytes32(0));
    }

    function testUpdateChannelMetadataCidMultipleTimes() public {
        bytes32 first = bytes32(uint256(0xAA));
        bytes32 second = bytes32(uint256(0xBB));

        vm.prank(creator);
        festival.updateChannelMetadataCid(first);
        assertEq(festival.channelMetadataCid(), first);

        vm.expectEmit(false, false, false, true, address(festival));
        emit Festival.ChannelMetadataUpdated(second);
        vm.prank(creator);
        festival.updateChannelMetadataCid(second);
        assertEq(festival.channelMetadataCid(), second);
    }

    // --- Role assignments ---

    function testCreatorHasAllRoles() public view {
        assertTrue(festival.hasRole(festival.DEFAULT_ADMIN_ROLE(), creator));
        assertTrue(festival.hasRole(festival.MANAGER_ROLE(), creator));
        assertTrue(festival.hasRole(festival.VOLUNTEER_ROLE(), creator));
    }

    // --- Registration ---

    function testRegisterHappyPath() public {
        vm.prank(alice);
        festival.register();

        assertTrue(festival.isRegistered(alice));
        assertEq(festival.ticketOf(alice), 1);
        assertEq(festival.registeredCount(), 1);
        assertEq(festival.ownerOf(1), alice);
    }

    function testRegisterAlreadyRegisteredReverts() public {
        vm.startPrank(alice);
        festival.register();
        vm.expectRevert(Festival.AlreadyRegistered.selector);
        festival.register();
        vm.stopPrank();
    }

    function testRegisterEventFullReverts() public {
        Festival small = _deploySimpleFestival(creator, 1);

        vm.prank(alice);
        small.register();

        vm.prank(bob);
        vm.expectRevert(Festival.EventFull.selector);
        small.register();
    }

    function testRegisterCancelledReverts() public {
        vm.prank(creator);
        festival.cancel();

        vm.prank(alice);
        vm.expectRevert(Festival.IsCancelled.selector);
        festival.register();
    }

    // --- Check-in ---

    function testCheckInHappyPath() public {
        vm.prank(alice);
        festival.register();

        vm.prank(creator);
        festival.checkIn(alice);

        assertTrue(festival.isCheckedIn(alice));
    }

    function testCheckInMintsPoap() public {
        vm.prank(alice);
        festival.register();

        vm.prank(creator);
        festival.checkIn(alice);

        assertEq(festivalPoap.balanceOf(alice), 1);
    }

    function testCheckInNotRegisteredReverts() public {
        vm.prank(creator);
        vm.expectRevert(Festival.NotRegistered.selector);
        festival.checkIn(alice);
    }

    function testCheckInAlreadyCheckedInReverts() public {
        vm.prank(alice);
        festival.register();

        vm.startPrank(creator);
        festival.checkIn(alice);
        vm.expectRevert(Festival.AlreadyCheckedIn.selector);
        festival.checkIn(alice);
        vm.stopPrank();
    }

    function testCheckInByStaff() public {
        bytes32 volunteerRole = keccak256("VOLUNTEER_ROLE");
        vm.prank(creator);
        festival.grantRole(volunteerRole, staff);

        vm.prank(alice);
        festival.register();

        vm.prank(staff);
        festival.checkIn(alice);

        assertTrue(festival.isCheckedIn(alice));
    }

    function testCheckInUnauthorizedReverts() public {
        vm.prank(alice);
        festival.register();

        vm.prank(unauthorized);
        vm.expectRevert();
        festival.checkIn(alice);
    }

    // --- Manual Check-in ---

    function testManualCheckInUnregistered() public {
        vm.prank(creator);
        festival.manualCheckIn(alice);

        assertTrue(festival.isRegistered(alice));
        assertTrue(festival.isCheckedIn(alice));
        assertEq(festival.registeredCount(), 1);
    }

    function testManualCheckInRegistered() public {
        vm.prank(alice);
        festival.register();

        vm.prank(creator);
        festival.manualCheckIn(alice);

        assertTrue(festival.isCheckedIn(alice));
        assertEq(festival.registeredCount(), 1); // no double count
    }

    function testManualCheckInAlreadyCheckedInReverts() public {
        vm.prank(alice);
        festival.register();

        vm.startPrank(creator);
        festival.checkIn(alice);
        vm.expectRevert(Festival.AlreadyCheckedIn.selector);
        festival.manualCheckIn(alice);
        vm.stopPrank();
    }

    // --- UpdateCid ---

    function testUpdateCid() public {
        bytes32 newCid = bytes32(uint256(0xCAFE));
        vm.prank(creator);
        festival.updateCid(newCid);
        assertEq(festival.metadataCid(), newCid);
    }

    function testUpdateCidUnauthorizedReverts() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        festival.updateCid(bytes32(0));
    }

    function testUpdateCidByAdminOnly() public {
        // staff has only DEFAULT_ADMIN_ROLE. No MANAGER_ROLE granted.
        bytes32 adminRole = festival.DEFAULT_ADMIN_ROLE();
        vm.prank(creator);
        festival.grantRole(adminRole, staff);

        bytes32 newCid = bytes32(uint256(0xCAFE));
        vm.prank(staff);
        festival.updateCid(newCid);
        assertEq(festival.metadataCid(), newCid);
    }

    function testUpdateCidByManagerOnly() public {
        // staff has only MANAGER_ROLE. No DEFAULT_ADMIN_ROLE granted.
        bytes32 managerRole = festival.MANAGER_ROLE();
        vm.prank(creator);
        festival.grantRole(managerRole, staff);

        bytes32 newCid = bytes32(uint256(0xBEEF));
        vm.prank(staff);
        festival.updateCid(newCid);
        assertEq(festival.metadataCid(), newCid);
    }

    function testUpdateCidZeroReverts() public {
        vm.prank(creator);
        vm.expectRevert(Festival.MissingMetadata.selector);
        festival.updateCid(bytes32(0));
    }

    function testUpdateCidByVolunteerOnlyReverts() public {
        // VOLUNTEER_ROLE alone is not enough to update CID.
        bytes32 volunteerRole = festival.VOLUNTEER_ROLE();
        vm.prank(creator);
        festival.grantRole(volunteerRole, staff);

        vm.prank(staff);
        vm.expectRevert();
        festival.updateCid(bytes32(uint256(0xDEAD)));
    }

    // --- UpdateCapacity ---

    function testUpdateCapacity() public {
        vm.prank(creator);
        festival.updateCapacity(200);
        assertEq(festival.capacity(), 200);
    }

    function testUpdateCapacityBelowRegisteredReverts() public {
        vm.prank(alice);
        festival.register();
        vm.prank(bob);
        festival.register();

        vm.prank(creator);
        vm.expectRevert(Festival.CapacityBelowRegistered.selector);
        festival.updateCapacity(1);
    }

    function testUpdateCapacityByAdminOnly() public {
        // staff has only DEFAULT_ADMIN_ROLE. No MANAGER_ROLE granted.
        bytes32 adminRole = festival.DEFAULT_ADMIN_ROLE();
        vm.prank(creator);
        festival.grantRole(adminRole, staff);

        vm.prank(staff);
        festival.updateCapacity(200);
        assertEq(festival.capacity(), 200);
    }

    function testUpdateCapacityByManagerOnly() public {
        bytes32 managerRole = festival.MANAGER_ROLE();
        vm.prank(creator);
        festival.grantRole(managerRole, staff);

        vm.prank(staff);
        festival.updateCapacity(150);
        assertEq(festival.capacity(), 150);
    }

    function testUpdateCapacityByVolunteerOnlyReverts() public {
        bytes32 volunteerRole = festival.VOLUNTEER_ROLE();
        vm.prank(creator);
        festival.grantRole(volunteerRole, staff);

        vm.prank(staff);
        vm.expectRevert();
        festival.updateCapacity(50);
    }

    function testUpdateCapacityUnauthorizedReverts() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        festival.updateCapacity(50);
    }

    // --- Cancel ---

    function testCancel() public {
        vm.prank(creator);
        festival.cancel();
        assertTrue(festival.cancelled());
    }

    function testCancelBlocksRegister() public {
        vm.prank(creator);
        festival.cancel();

        vm.prank(alice);
        vm.expectRevert(Festival.IsCancelled.selector);
        festival.register();
    }

    function testCancelOnlyAdmin() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        festival.cancel();
    }

    // --- getEventDetails ---

    function testGetEventDetails() public view {
        (
            bytes32 cid, address c, address fp, address sep,
            uint64 st, uint64 et,
            bool se, uint32 cap,
            bool can, uint256 rc
        ) = festival.getEventDetails();

        assertEq(cid, CID);
        assertEq(c, creator);
        assertEq(fp, address(festivalPoap));
        assertEq(sep, address(sessionPoap));
        assertEq(st, START);
        assertEq(et, END);
        assertTrue(se);
        assertEq(cap, CAPACITY);
        assertFalse(can);
        assertEq(rc, 0);
    }

    // --- Sub-event creation ---

    function testCreateSession() public {
        // Creator must register + checkIn to get POAP first
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        vm.prank(creator);
        address subAddr = festival.createSession(
            CID, START, END - 1000, creatorPoapToken
        );

        assertTrue(festival.isSession(subAddr));
        assertEq(festival.getSessionCount(), 1);

        FestivalSession sub = FestivalSession(payable(subAddr));
        assertEq(sub.parentFestival(), address(festival));
    }

    function testCreateSessionByPoapHolder() public {
        // Alice registers and checks in → gets POAP
        vm.prank(alice);
        festival.register();
        vm.prank(creator);
        festival.checkIn(alice);

        // Alice's POAP token is 1 (no creator auto-check-in)
        uint256 aliceToken = 1;

        // Alice can create sub-event
        vm.prank(alice);
        address subAddr = festival.createSession(CID, START, END - 1000, aliceToken);
        assertTrue(festival.isSession(subAddr));
    }

    function testCreateSessionUnauthorizedReverts() public {
        // Bob has no POAP and no role
        vm.prank(bob);
        vm.expectRevert();
        festival.createSession(CID, START, END - 1000, 999);
    }

    function testCreateSessionMissingMetadataReverts() public {
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        vm.prank(creator);
        vm.expectRevert(Festival.MissingMetadata.selector);
        festival.createSession(bytes32(0), START, END - 1000, creatorPoapToken);
    }

    function testCreateSessionDisabledReverts() public {
        vm.prank(creator);
        festival.updateSessionsEnabled(false);

        vm.prank(creator);
        vm.expectRevert(Festival.SessionsDisabled.selector);
        festival.createSession(CID, START, END - 1000, 0);
    }

    function testCreateSessionTimeBoundsCheck() public {
        // Creator must register + checkIn to get POAP first
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        vm.prank(creator);
        vm.expectRevert(Festival.SessionStartsBeforeFestival.selector);
        festival.createSession(CID, START - 1, END - 1000, creatorPoapToken);

        vm.prank(creator);
        vm.expectRevert(Festival.SessionEndsAfterFestival.selector);
        festival.createSession(CID, START, END + 1, creatorPoapToken);
    }

    function testCreateSessionInvalidTimeRangeReverts() public {
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        // endTime == startTime
        vm.prank(creator);
        vm.expectRevert(Festival.InvalidTimeRange.selector);
        festival.createSession(CID, START + 1000, START + 1000, creatorPoapToken);

        // endTime < startTime
        vm.prank(creator);
        vm.expectRevert(Festival.InvalidTimeRange.selector);
        festival.createSession(CID, START + 2000, START + 1000, creatorPoapToken);
    }

    // --- Session Limit ---

    function testSessionLimitPerDay() public {
        // Creator registers + checks in to get POAP
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        // Create 2 sessions on day 0 → both succeed
        vm.prank(creator);
        festival.createSession(CID, START, START + 3600, creatorPoapToken);
        vm.prank(creator);
        festival.createSession(CID, START + 3600, START + 7200, creatorPoapToken);

        // 3rd session on day 0 → reverts
        vm.prank(creator);
        vm.expectRevert(Festival.SessionLimitReached.selector);
        festival.createSession(CID, START + 7200, START + 10800, creatorPoapToken);
    }

    function testSessionLimitDifferentDays() public {
        // Creator registers + checks in
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        // 2 sessions on day 0
        vm.prank(creator);
        festival.createSession(CID, START, START + 3600, creatorPoapToken);
        vm.prank(creator);
        festival.createSession(CID, START + 3600, START + 7200, creatorPoapToken);

        // 2 sessions on day 1 → both succeed (different day)
        uint64 day1Start = START + 86400;
        vm.prank(creator);
        festival.createSession(CID, day1Start, day1Start + 3600, creatorPoapToken);
        vm.prank(creator);
        festival.createSession(CID, day1Start + 3600, day1Start + 7200, creatorPoapToken);
    }

    function testCancelSessionFreesSlot() public {
        // Creator registers + checks in
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        // Create 2 sessions on day 0
        vm.prank(creator);
        address s1 = festival.createSession(CID, START, START + 3600, creatorPoapToken);
        vm.prank(creator);
        festival.createSession(CID, START + 3600, START + 7200, creatorPoapToken);

        // Cancel the first one → frees a slot
        vm.prank(creator);
        festival.cancelSession(s1);

        // Now a 3rd session on day 0 succeeds
        vm.prank(creator);
        festival.createSession(CID, START + 7200, START + 10800, creatorPoapToken);
    }

    function testCancelSessionAlreadyCancelledReverts() public {
        vm.prank(creator);
        festival.register();
        vm.prank(creator);
        festival.checkIn(creator);
        uint256 creatorPoapToken = 1;

        vm.prank(creator);
        address s1 = festival.createSession(CID, START, START + 3600, creatorPoapToken);

        // First cancel succeeds
        vm.prank(creator);
        festival.cancelSession(s1);

        // Second cancel reverts cleanly
        vm.prank(creator);
        vm.expectRevert(Festival.SessionAlreadyCancelled.selector);
        festival.cancelSession(s1);
    }

    // --- Cancel Session via Flagging ---

    /// @dev Register + check in attendee on the festival, returning their festival POAP token id.
    function _checkInAttendee(address attendee) internal returns (uint256 tokenId) {
        vm.prank(attendee);
        festival.register();
        vm.prank(creator);
        festival.checkIn(attendee);
        uint256[] memory tokens = festivalPoap.getTokensBySource(address(festival));
        tokenId = tokens[tokens.length - 1];
    }

    /// @dev subCreator creates one session and 5 distinct festival POAP holders flag it.
    function _flagSessionToThreshold() internal returns (FestivalSession session, address subCreator) {
        subCreator = makeAddr("subCreator");
        uint256 subPoap = _checkInAttendee(subCreator);

        vm.prank(subCreator);
        address s = festival.createSession(CID, START, START + 3600, subPoap);
        session = FestivalSession(payable(s));

        address[5] memory flaggers = [
            makeAddr("flag1"), makeAddr("flag2"), makeAddr("flag3"),
            makeAddr("flag4"), makeAddr("flag5")
        ];
        for (uint256 i = 0; i < flaggers.length; i++) {
            uint256 t = _checkInAttendee(flaggers[i]);
            vm.prank(flaggers[i]);
            session.flag(t);
        }
        assertEq(session.flagCount(), 5);
    }

    function testCancelSessionAtThresholdByAdmin() public {
        (FestivalSession session, address subCreator) = _flagSessionToThreshold();

        // Festival admin (creator) cancels the flagged session.
        vm.expectEmit(true, true, false, true, address(festival));
        emit Festival.SessionCancelledByFlagging(address(session), subCreator, 5);
        vm.prank(creator);
        festival.cancelSession(address(session));

        assertTrue(session.cancelled());
    }

    function testCancelSessionAtThresholdByManager() public {
        (FestivalSession session,) = _flagSessionToThreshold();

        // Grant manager role to staff. Pre-resolve role bytes so vm.prank applies to grantRole,
        // not to the inline MANAGER_ROLE() getter.
        bytes32 managerRole = festival.MANAGER_ROLE();
        vm.prank(creator);
        festival.grantRole(managerRole, staff);

        vm.prank(staff);
        festival.cancelSession(address(session));
        assertTrue(session.cancelled());
    }

    function testCancelSessionAtThresholdByCreatorReverts() public {
        (FestivalSession session, address subCreator) = _flagSessionToThreshold();

        // Session creator cannot self-cancel a flagged session, even though they
        // hold DEFAULT_ADMIN_ROLE on the session itself.
        vm.prank(subCreator);
        vm.expectRevert(Festival.NotAuthorizedToCancelSession.selector);
        festival.cancelSession(address(session));
    }

    function testCancelSessionAtThresholdByVolunteerReverts() public {
        (FestivalSession session,) = _flagSessionToThreshold();

        // Grant only volunteer role to staff. Not enough.
        bytes32 volunteerRole = festival.VOLUNTEER_ROLE();
        vm.prank(creator);
        festival.grantRole(volunteerRole, staff);

        vm.prank(staff);
        vm.expectRevert(Festival.NotAuthorizedToCancelSession.selector);
        festival.cancelSession(address(session));
    }

    function testCancelSessionAtThresholdByRandomReverts() public {
        (FestivalSession session,) = _flagSessionToThreshold();

        vm.prank(unauthorized);
        vm.expectRevert(Festival.NotAuthorizedToCancelSession.selector);
        festival.cancelSession(address(session));
    }

    function testCancelSessionAtThresholdConsumesSlot() public {
        (FestivalSession session, address subCreator) = _flagSessionToThreshold();

        // Pre-condition: the flagged session already used 1 of subCreator's 2 day-0 slots.
        // Admin moderation-cancels the session. Slot must NOT be restored.
        vm.prank(creator);
        festival.cancelSession(address(session));

        // Look up subCreator's festival POAP token id.
        uint256[] memory tokens = festivalPoap.getTokensBySource(address(festival));
        uint256 subPoapToken;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (festivalPoap.ownerOf(tokens[i]) == subCreator) {
                subPoapToken = tokens[i];
                break;
            }
        }

        // Quota is 2/day; first slot is consumed, second is still free → one more succeeds.
        vm.prank(subCreator);
        festival.createSession(CID, START + 3600, START + 7200, subPoapToken);

        // A third on day 0 reverts. The moderation-cancelled slot stays consumed.
        vm.prank(subCreator);
        vm.expectRevert(Festival.SessionLimitReached.selector);
        festival.createSession(CID, START + 7200, START + 10800, subPoapToken);
    }

    function testCancelSessionBelowThresholdRestoresSlot() public {
        // Build a session with only 4 flags. Still cancellable by creator with slot restored.
        address subCreator = makeAddr("subCreator2");
        uint256 subPoap = _checkInAttendee(subCreator);

        vm.prank(subCreator);
        address s = festival.createSession(CID, START, START + 3600, subPoap);
        FestivalSession session = FestivalSession(payable(s));

        // 4 flags only
        address[4] memory flaggers = [
            makeAddr("bf1"), makeAddr("bf2"), makeAddr("bf3"), makeAddr("bf4")
        ];
        for (uint256 i = 0; i < flaggers.length; i++) {
            uint256 t = _checkInAttendee(flaggers[i]);
            vm.prank(flaggers[i]);
            session.flag(t);
        }
        assertEq(session.flagCount(), 4);

        // Creator cancels (below threshold path). Slot is restored.
        vm.prank(subCreator);
        festival.cancelSession(s);
        assertTrue(session.cancelled());

        // Creator can now create 2 fresh sessions on day 0 (slot restored).
        vm.prank(subCreator);
        festival.createSession(CID, START + 3600, START + 7200, subPoap);
        vm.prank(subCreator);
        festival.createSession(CID, START + 7200, START + 10800, subPoap);
    }

    function testCancelSessionBelowThresholdByFestivalAdminReverts() public {
        // Below threshold: only the session admin (creator) can cancel. Festival admin
        // cannot reach in for non-flagged sessions.
        address subCreator = makeAddr("subCreator3");
        uint256 subPoap = _checkInAttendee(subCreator);

        vm.prank(subCreator);
        address s = festival.createSession(CID, START, START + 3600, subPoap);

        vm.prank(creator); // festival admin, but not session admin
        vm.expectRevert(Festival.NotAuthorizedToCancelSession.selector);
        festival.cancelSession(s);
    }

    // --- Enumerable Roles ---

    function testGetRoleMemberCount() public view {
        assertEq(festival.getRoleMemberCount(festival.DEFAULT_ADMIN_ROLE()), 1);
        assertEq(festival.getRoleMemberCount(festival.MANAGER_ROLE()), 1);
    }

    function testGetRoleMembers() public {
        bytes32 volunteerRole = keccak256("VOLUNTEER_ROLE");

        vm.prank(creator);
        festival.grantRole(volunteerRole, staff);

        assertEq(festival.getRoleMemberCount(volunteerRole), 2);
        assertEq(festival.getRoleMember(volunteerRole, 0), creator);
        assertEq(festival.getRoleMember(volunteerRole, 1), staff);
    }
}
