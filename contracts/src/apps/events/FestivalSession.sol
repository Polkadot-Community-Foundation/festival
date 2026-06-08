// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import "../../protocols/nontransferable/NonTransferableERC721.sol";
import "../../protocols/poap/IAttendancePOAP.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/// @dev Minimal view into the parent festival, used to gate session check-in on
/// the attendee already holding a festival check-in (and therefore a festival POAP).
interface IFestivalParent {
    function isCheckedIn(address attendee) external view returns (bool);
}

/// @title FestivalSession: Child event contract with its own lifecycle
/// @notice Structurally similar to Festival but without session management.
/// Links to a parent festival via immutable `parentFestival`.
contract FestivalSession is NonTransferableERC721, AccessControlEnumerable {
    // ── Role Constants ──

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant VOLUNTEER_ROLE = keccak256("VOLUNTEER_ROLE");

    // ── Errors ──

    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyCheckedIn();
    error IsCancelled();
    error NotAuthorized();
    error CreatorAlreadyInitialized();
    error NotFestivalPoapHolder();
    error AlreadyFlagged();
    error CannotFlagOwnSession();
    error FestivalCheckInRequired();
    error MissingMetadata();

    // ── Events ──

    event Registered(address indexed attendee, uint256 tokenId);
    event CheckedIn(address indexed attendee);
    event MetadataUpdated(bytes32 newCid);
    event SessionCancelled();
    event SessionFlagged(address indexed flagger, uint256 newCount);

    // ── Constants ──

    uint256 public constant FLAG_THRESHOLD = 5;

    // ── Storage ──

    bytes32 public metadataCid;
    address public creator;
    address public poapContract;
    address public festivalPoapContract;
    address public immutable parentFestival;
    uint64 public startTime;
    uint64 public endTime;
    bool public cancelled;
    uint256 public flagCount;
    mapping(address => bool) public hasFlagged;

    bool private _creatorInitialized;

    uint256 private constant CREATOR_TOKEN_ID = type(uint256).max;
    uint256 private _nextTokenId = 1;
    uint256 public registeredCount;
    address[] private _attendees;

    mapping(address => bool) public isRegistered;
    mapping(address => bool) public isCheckedIn;
    mapping(address => uint256) public ticketOf;

    // ── Modifiers ──

    modifier notCancelled() {
        if (cancelled) revert IsCancelled();
        _;
    }

    // ── Constructor ──

    constructor(
        address _creator,
        address _poapContract,
        bytes32 _metadataCid,
        uint64 _startTimestamp,
        uint64 _endTimestamp,
        address _parentFestival,
        address _festivalPoapContract
    ) NonTransferableERC721("Session Ticket", "STICKET") {
        creator = _creator;
        poapContract = _poapContract;
        metadataCid = _metadataCid;
        startTime = _startTimestamp;
        endTime = _endTimestamp;
        parentFestival = _parentFestival;
        festivalPoapContract = _festivalPoapContract;

        // Grant all roles to creator
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        _grantRole(MANAGER_ROLE, _creator);
        _grantRole(VOLUNTEER_ROLE, _creator);
    }

    /// @notice One-shot creator auto-check-in. Called by parent festival after POAP minter authorization.
    function initCreator() external {
        if (msg.sender != parentFestival) revert NotAuthorized();
        if (_creatorInitialized) revert CreatorAlreadyInitialized();
        _creatorInitialized = true;

        _safeMint(creator, CREATOR_TOKEN_ID);
        isRegistered[creator] = true;
        ticketOf[creator] = CREATOR_TOKEN_ID;
        isCheckedIn[creator] = true;
        _attendees.push(creator);

        if (poapContract != address(0)) {
            IAttendancePOAP(poapContract).mintPOAP(creator, address(this));
        }

        emit Registered(creator, CREATOR_TOKEN_ID);
        emit CheckedIn(creator);
    }

    // ── Event Lifecycle ──

    function register() external notCancelled {
        if (isRegistered[msg.sender]) revert AlreadyRegistered();

        uint256 tokenId = _nextTokenId++;
        isRegistered[msg.sender] = true;
        ticketOf[msg.sender] = tokenId;
        registeredCount++;
        _attendees.push(msg.sender);

        _safeMint(msg.sender, tokenId);

        emit Registered(msg.sender, tokenId);
    }

    function checkIn(address attendee) external notCancelled {
        _requireVolunteerRole();
        if (!IFestivalParent(parentFestival).isCheckedIn(attendee)) revert FestivalCheckInRequired();
        if (!isRegistered[attendee]) revert NotRegistered();
        if (isCheckedIn[attendee]) revert AlreadyCheckedIn();

        isCheckedIn[attendee] = true;
        if (poapContract != address(0)) {
            IAttendancePOAP(poapContract).mintPOAP(attendee, address(this));
        }

        emit CheckedIn(attendee);
    }

    function manualCheckIn(address attendee) external notCancelled {
        _requireVolunteerRole();
        if (!IFestivalParent(parentFestival).isCheckedIn(attendee)) revert FestivalCheckInRequired();
        if (isCheckedIn[attendee]) revert AlreadyCheckedIn();

        if (!isRegistered[attendee]) {
            uint256 tokenId = _nextTokenId++;
            isRegistered[attendee] = true;
            ticketOf[attendee] = tokenId;
            registeredCount++;
            _attendees.push(attendee);

            _safeMint(attendee, tokenId);

            emit Registered(attendee, tokenId);
        }

        isCheckedIn[attendee] = true;
        if (poapContract != address(0)) {
            IAttendancePOAP(poapContract).mintPOAP(attendee, address(this));
        }

        emit CheckedIn(attendee);
    }

    function updateCid(bytes32 newCid) external {
        _requireManagerRole();
        if (newCid == bytes32(0)) revert MissingMetadata();
        metadataCid = newCid;
        emit MetadataUpdated(newCid);
    }

    function cancel() external notCancelled {
        if (msg.sender != parentFestival) revert NotAuthorized();
        cancelled = true;
        emit SessionCancelled();
    }

    /// @notice Flag this session. Caller must hold a festival POAP minted by the parent festival.
    /// @dev One flag per address. Once `flagCount >= FLAG_THRESHOLD`, the parent festival's
    /// admin/manager can cancel the session via `Festival.cancelSession`, and the creator's
    /// per-day session slot is not restored.
    function flag(uint256 festivalPoapTokenId) external notCancelled {
        if (msg.sender == creator) revert CannotFlagOwnSession();
        if (hasFlagged[msg.sender]) revert AlreadyFlagged();

        IAttendancePOAP.POAPData memory data =
            IAttendancePOAP(festivalPoapContract).getPOAPData(festivalPoapTokenId);
        if (data.attendee != msg.sender || data.sourceContract != parentFestival) {
            revert NotFestivalPoapHolder();
        }

        hasFlagged[msg.sender] = true;
        flagCount++;

        emit SessionFlagged(msg.sender, flagCount);
    }

    // ── Views ──

    function getAttendees()
        external
        view
        returns (address[] memory attendees, bool[] memory checkedInStatus)
    {
        attendees = _attendees;
        checkedInStatus = new bool[](attendees.length);
        for (uint256 i = 0; i < attendees.length; i++) {
            checkedInStatus[i] = isCheckedIn[attendees[i]];
        }
    }

    function getEventDetails()
        external
        view
        returns (
            bytes32, address, address, address,
            uint64, uint64,
            bool, uint256
        )
    {
        return (
            metadataCid, creator, poapContract, parentFestival,
            startTime, endTime,
            cancelled, registeredCount
        );
    }

    // ── Internal ──

    function _requireVolunteerRole() internal view {
        if (
            !hasRole(VOLUNTEER_ROLE, msg.sender) &&
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert AccessControlUnauthorizedAccount(msg.sender, VOLUNTEER_ROLE);
        }
    }

    function _requireManagerRole() internal view {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert AccessControlUnauthorizedAccount(msg.sender, MANAGER_ROLE);
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControlEnumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

}
