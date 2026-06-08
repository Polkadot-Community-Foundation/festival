# Festival & Session Contracts

Core application contracts for the festival system prototype. A Festival is the top-level event; Sessions are attendee-created activities within a festival (unconference pattern).

## Contracts

### `Festival.sol`

The main event contract. Inherits `NonTransferableERC721` (soulbound tickets) and `AccessControlEnumerable` (role-based access).

**Constructor:** `Festival(creator, festivalPoapContract, sessionPoapContract, sessionsEnabled)`

All three roles are granted to the creator at construction.

**One-shot setup:** `setup(metadataCid, channelMetadataCid, startTime, endTime, capacity)` — called once by admin after deployment to configure the festival. `channelMetadataCid` points at the festival's announcement channel blob on the Bulletin Chain (see _Announcement channel_ below). Must be called after Festival is authorized as a minter on the festival POAP contract. Reverts with `AlreadyConfigured` on second call, `MissingMetadata` / `MissingChannelMetadata` if either CID is zero, and `InvalidTimeRange` if `endTime <= startTime`.

#### Roles

| Role      | Constant             | Permissions                                                 |
| --------- | -------------------- | ----------------------------------------------------------- |
| Admin     | `DEFAULT_ADMIN_ROLE` | Cancel festival, manage roles, toggle sessions, + all below |
| Manager   | `MANAGER_ROLE`       | Update metadata CID, update capacity, + all below           |
| Volunteer | `VOLUNTEER_ROLE`     | Check in attendees (`checkIn`, `manualCheckIn`)             |

All three implicitly satisfy the volunteer check — admin and manager can check in attendees too.

#### Registration & Check-In

| Function                  | Access     | Description                                                                               |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `register()`              | Anyone     | Mints a soulbound ticket NFT. Enforces capacity if set (0 = unlimited). Free, no pricing. |
| `checkIn(attendee)`       | Volunteer+ | Marks registered attendee as checked in, mints a festival POAP atomically.                |
| `manualCheckIn(attendee)` | Volunteer+ | Registers + checks in + mints POAP in one call. For off-chain ticket holders.             |

The creator is **not** auto-checked-in. They register and check themselves in like any other attendee (they have VOLUNTEER_ROLE, so `checkIn(self)` works).

#### Session Management

| Function                                              | Access                | Description                                                                                                                       |
| ----------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `createSession(metadataCid, start, end, poapTokenId)` | Festival POAP holders | Deploy a new FestivalSession. POAP-gated: caller must own a festival POAP from this contract. Max 2 per creator per festival day. |
| `cancelSession(sessionAddr)`                          | Dual-path (see below) | Cancel a session. Authorization and per-day-slot accounting depend on whether the session has been flagged.                       |
| `updateSessionsEnabled(enabled)`                      | Admin                 | Toggle whether session creation is allowed.                                                                                       |

**`cancelSession` dual path:**

| Condition                     | Authorized caller                                                                                                                              | Per-day slot                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `flagCount < FLAG_THRESHOLD`  | Anyone with `DEFAULT_ADMIN_ROLE` on the **session** (typically the session creator)                                                            | Refunded — frees a slot for the creator |
| `flagCount >= FLAG_THRESHOLD` | Festival `DEFAULT_ADMIN_ROLE` or `MANAGER_ROLE`. **The session creator is explicitly blocked** so they cannot self-cancel to dodge moderation. | Not refunded — the slot stays consumed  |

The moderation path emits `SessionCancelledByFlagging(sessionAddr, creator, flagCount)`.

**Day calculation:** `dayIndex = (sessionStart - festivalStart) / 86400`. This is festival-relative, so the organizer controls day boundaries via the festival start time.

**Session creation flow:**

1. Verify caller owns a festival POAP from this contract
2. Validate session fits within festival time bounds
3. Check per-day limit (max 2)
4. Deploy `FestivalSession` contract
5. Authorize session as a minter on the session POAP contract
6. Auto-register and check in the session creator (via `initCreator()`)

#### Admin Functions

| Function                           | Access           | Description                                                                                                                                     |
| ---------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateCid(newCid)`                | Admin or Manager | Update `metadataCid`                                                                                                                            |
| `updateChannelMetadataCid(newCid)` | Admin or Manager | Update `channelMetadataCid` (the announcement channel pointer). Emits `ChannelMetadataUpdated`; reverts `MissingChannelMetadata` on a zero CID. |
| `updateCapacity(newCapacity)`      | Admin or Manager | Update capacity. Cannot go below current `registeredCount`.                                                                                     |
| `cancel()`                         | Admin            | Irreversible cancellation. Blocks all mutations.                                                                                                |

#### Announcement channel

A second off-chain blob, addressed by `channelMetadataCid`, holds the festival's
broadcast announcements. The contract stores only the 32-byte CID; the blob
itself is an append-only list of announcement CIDs on the Bulletin Chain. Admins
and managers publish by pushing a new entry and calling
`updateChannelMetadataCid` — every update emits `ChannelMetadataUpdated`, which
the attendee SPA watches to refresh its notifications view. This is a one-way
admin → attendee channel, not peer-to-peer chat.

#### Views

| Function            | Returns                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `getAttendees()`    | All attendee addresses + their check-in status                                                 |
| `getEventDetails()` | Full festival state: CID, creator, POAP contracts, times, capacity, cancelled, registeredCount |
| `getSessions()`     | All session contract addresses                                                                 |
| `getSessionCount()` | Number of sessions                                                                             |

#### Storage

| Variable                | Type                                              | Description                                         |
| ----------------------- | ------------------------------------------------- | --------------------------------------------------- |
| `metadataCid`           | `bytes32`                                         | Off-chain metadata CID (Bulletin Chain)             |
| `channelMetadataCid`    | `bytes32`                                         | Off-chain announcement-channel CID (Bulletin Chain) |
| `creator`               | `address`                                         | Festival creator                                    |
| `festivalPoapContract`  | `address`                                         | Festival-level AttendancePOAP                       |
| `sessionPoapContract`   | `address`                                         | Session-level AttendancePOAP                        |
| `startTime` / `endTime` | `uint64`                                          | Festival time bounds                                |
| `sessionsEnabled`       | `bool`                                            | Whether session creation is allowed                 |
| `capacity`              | `uint32`                                          | Max attendees (0 = unlimited)                       |
| `cancelled`             | `bool`                                            | Irreversible cancellation flag                      |
| `sessions`              | `address[]`                                       | All deployed session addresses                      |
| `isSession`             | `mapping(address => bool)`                        | Quick lookup for session validity                   |
| `sessionCreator`        | `mapping(address => address)`                     | Maps session address to its creator                 |
| `sessionsPerDay`        | `mapping(address => mapping(uint256 => uint256))` | Per-creator per-day session count                   |

---

### `FestivalSession.sol`

A child event contract created by Festival. Has its own registration, check-in, and POAP flow, but no session nesting. Linked to its parent via immutable `parentFestival`.

**Constructor:** `FestivalSession(creator, poapContract, metadataCid, startTimestamp, endTimestamp, parentFestival, festivalPoapContract)` — all configuration provided at deploy time (no separate `setup()` call). The `festivalPoapContract` is the address of the parent festival's POAP contract; it's used to gate flagging on festival-POAP ownership.

All three roles are granted to the session creator at construction.

The contract uses a minimal `IFestivalParent` interface to consult the parent festival on attendee check-in status:

```solidity
interface IFestivalParent {
    function isCheckedIn(address attendee) external view returns (bool);
}
```

#### Key Differences from Festival

| Feature                | Festival                           | FestivalSession                             |
| ---------------------- | ---------------------------------- | ------------------------------------------- |
| Capacity               | Configurable (`capacity`)          | None (unlimited)                            |
| Pricing                | None                               | None                                        |
| Session creation       | Yes (`createSession`)              | No (no nesting)                             |
| Creator auto-check-in  | No (registers normally)            | Yes (`initCreator()` called by parent)      |
| Cancel                 | Direct (`cancel()`, admin-only)    | Routed through Festival (`cancelSession()`) |
| Configuration          | Two-step (constructor + `setup()`) | One-step (constructor only)                 |
| Reporting / moderation | None                               | `flag()` + `FLAG_THRESHOLD` (see below)     |

#### Initialization (called by Festival)

| Function        | Caller          | Description                                                                                                                                    |
| --------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `initCreator()` | Parent Festival | One-shot auto-register + check-in for the session creator. Mints a special ticket (`CREATOR_TOKEN_ID = type(uint256).max`) and a session POAP. |

#### Registration & Check-In

Same pattern as Festival but without capacity checks. Session check-in additionally requires the attendee to already be checked in to the **parent festival**:

| Function                  | Access     | Description                                                                                                                                                                                         |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register()`              | Anyone     | Mints a soulbound session ticket. No capacity limit.                                                                                                                                                |
| `checkIn(attendee)`       | Volunteer+ | Marks registered attendee as checked in, mints session POAP. **Reverts `FestivalCheckInRequired` if the attendee is not checked in to the parent festival.**                                        |
| `manualCheckIn(attendee)` | Volunteer+ | Registers + checks in + mints POAP in one call. **Reverts `FestivalCheckInRequired` if the attendee is not checked in to the parent festival** — even though it would otherwise auto-register them. |

This gate ensures session attendance implies festival attendance: an attendee can pre-register for a session before being festival-checked-in, but can never be checked in to a session without first being checked in to the festival.

#### Reporting & Moderation

Festival POAP holders can flag a session they consider problematic. Once `flagCount` reaches `FLAG_THRESHOLD = 5`, the parent festival's admin or manager can moderation-cancel via `Festival.cancelSession(sessionAddr)` (see the `Festival.sol` cancel section above for details on how the slot accounting changes).

| Function                    | Access                                         | Description                                                                                                                                                  |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `flag(festivalPoapTokenId)` | Festival POAP holder (not the session creator) | Anonymously flag this session. Caller must own the supplied POAP token, which must have been minted by this session's parent festival. One flag per address. |

| Storage          | Type                       | Description                                                              |
| ---------------- | -------------------------- | ------------------------------------------------------------------------ |
| `FLAG_THRESHOLD` | `uint256` constant         | `5` — flag count at which the moderation-cancel branch unlocks.          |
| `flagCount`      | `uint256`                  | Total flags received. Monotonically increases until cancellation.        |
| `hasFlagged`     | `mapping(address => bool)` | Per-address flag record. Prevents double-flagging from the same address. |

| Event                               | Emitted on               |
| ----------------------------------- | ------------------------ |
| `SessionFlagged(flagger, newCount)` | Each successful `flag()` |

| Error                   | Trigger                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `NotFestivalPoapHolder` | The caller doesn't own the supplied POAP token, or the token isn't from this session's parent festival. |
| `AlreadyFlagged`        | The caller has already flagged this session.                                                            |
| `CannotFlagOwnSession`  | The session creator attempted to flag their own session.                                                |

#### Cancellation

`cancel()` is restricted to `msg.sender == parentFestival`. Direct calls revert with `NotAuthorized`. Cancellation goes through `Festival.cancelSession(sessionAddr)`.

#### Admin Functions

| Function            | Access           | Description                 |
| ------------------- | ---------------- | --------------------------- |
| `updateCid(newCid)` | Admin or Manager | Update session metadata CID |

#### Views

| Function            | Returns                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `getAttendees()`    | All attendee addresses + check-in status                                      |
| `getEventDetails()` | CID, creator, poapContract, parentFestival, times, cancelled, registeredCount |

---

## Deployment Sequence

```
1. Deploy festivalPoap = new AttendancePOAP(deployer)
2. Deploy sessionPoap = new AttendancePOAP(deployer)
3. Deploy festival = new Festival(deployer, festivalPoap, sessionPoap, true)
4. festivalPoap.authorizeMinter(festival)         // Festival can mint festival POAPs
5. sessionPoap.transferFactory(festival)           // Festival can authorize session minters
6. festival.setup(cid, channelCid, start, end, capacity)
```

After setup, the creator registers and checks themselves in:

```
7. festival.register()                             // Creator gets ticket #1
8. festival.checkIn(creator)                       // Creator gets festival POAP #1
```

Now the creator can create sessions using their POAP token.

## Error Reference

| Error                            | Contract | Trigger                                                                                                                                                                        |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AlreadyRegistered()`            | Both     | `register()` called twice                                                                                                                                                      |
| `NotRegistered()`                | Both     | `checkIn()` for unregistered attendee                                                                                                                                          |
| `AlreadyCheckedIn()`             | Both     | `checkIn()` / `manualCheckIn()` for already checked-in attendee                                                                                                                |
| `EventFull()`                    | Festival | `register()` when capacity reached                                                                                                                                             |
| `IsCancelled()`                  | Both     | Any mutation on a cancelled contract                                                                                                                                           |
| `CapacityBelowRegistered()`      | Festival | `updateCapacity()` below current count                                                                                                                                         |
| `AlreadyConfigured()`            | Festival | `setup()` called twice                                                                                                                                                         |
| `MissingMetadata()`              | Festival | `setup()` / `createSession()` with a zero `metadataCid`                                                                                                                        |
| `MissingChannelMetadata()`       | Festival | `setup()` / `updateChannelMetadataCid()` with a zero `channelMetadataCid`                                                                                                      |
| `InvalidTimeRange()`             | Festival | `setup()` with `endTime <= startTime`                                                                                                                                          |
| `SessionsDisabled()`             | Festival | `createSession()` when disabled                                                                                                                                                |
| `NotAuthorizedToCreateSession()` | Festival | Invalid POAP for session creation, or unauthorized cancel                                                                                                                      |
| `SessionStartsBeforeFestival()`  | Festival | Session start < festival start                                                                                                                                                 |
| `SessionEndsAfterFestival()`     | Festival | Session end > festival end                                                                                                                                                     |
| `SessionLimitReached()`          | Festival | 3rd session on same festival day                                                                                                                                               |
| `NotASession()`                  | Festival | `cancelSession()` with unknown address                                                                                                                                         |
| `NotAuthorizedToCancelSession()` | Festival | `cancelSession()` caller fails the dual-path auth: below threshold needs session admin; at/above threshold needs festival admin/manager and is blocked for the session creator |
| `SessionAlreadyCancelled()`      | Festival | `cancelSession()` on an already-cancelled session                                                                                                                              |
| `NotAuthorized()`                | Session  | Direct `cancel()` call (must go through Festival)                                                                                                                              |
| `CreatorAlreadyInitialized()`    | Session  | `initCreator()` called twice                                                                                                                                                   |
| `FestivalCheckInRequired()`      | Session  | `checkIn()` / `manualCheckIn()` for an attendee not yet checked in to the parent festival                                                                                      |
| `NotFestivalPoapHolder()`        | Session  | `flag()` with a POAP token the caller doesn't own, or one not minted by the parent festival                                                                                    |
| `AlreadyFlagged()`               | Session  | `flag()` called twice from the same address                                                                                                                                    |
| `CannotFlagOwnSession()`         | Session  | Session creator called `flag()` on their own session                                                                                                                           |
