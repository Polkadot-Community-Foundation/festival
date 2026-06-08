# POAP Protocol

Proof of Attendance NFT system. Non-transferable tokens shared across festivals and sessions.

## Overview

The POAP protocol provides a non-transferable NFT that proves an attendee was physically present at a specific activity. It uses a factory-authorized minting pattern: the factory address controls minter authorization, and only authorized contracts (Festival, FestivalSession) can mint POAPs.

Two separate AttendancePOAP instances are deployed per festival:

- **Festival POAP** — minted on festival check-in, factory rights retained by deployer (who authorizes Festival as a minter)
- **Session POAP** — minted on session check-in, factory rights transferred to the Festival contract (which authorizes each session as a minter)

## Architecture

```
Deployer EOA (factory)
    │
    ├── authorizeMinter(festivalAddress)
    │
    ▼
AttendancePOAP (festival-level)
    │
    ├── mintPOAP(attendee, sourceContract)  ← called by Festival.checkIn()
    │
    ▼
Non-transferable NFT minted to attendee

Festival (factory for session POAP)
    │
    ├── authorizeMinter(sessionAddress)
    │
    ▼
AttendancePOAP (session-level)
    │
    ├── mintPOAP(attendee, sourceContract)  ← called by FestivalSession.checkIn()
    │
    ▼
Non-transferable NFT minted to attendee
```

## Contracts

### `IAttendancePOAP` (interface)

Defines the POAP protocol interface.

**Struct:**

```solidity
struct POAPData {
    address sourceContract;  // Contract that triggered the mint (Festival or FestivalSession)
    address attendee;        // Wallet that received the POAP
    uint64  issuedAt;        // Block timestamp when minted
}
```

**Functions:**

| Function                                             | Access             | Description                                   |
| ---------------------------------------------------- | ------------------ | --------------------------------------------- |
| `transferFactory(address)`                           | Factory only       | Transfer factory rights to a new address      |
| `renounceFactory()`                                  | Factory only       | Permanently renounce factory rights           |
| `authorizeMinter(address)`                           | Factory only       | Grant a contract permission to mint POAPs     |
| `revokeMinter(address)`                              | Factory only       | Revoke a contract's minting permission        |
| `mintPOAP(address attendee, address sourceContract)` | Authorized minters | Mint a POAP to an attendee, returns `tokenId` |
| `getPOAPData(uint256 tokenId)`                       | Public (view)      | Get metadata for a specific POAP token        |
| `getTokensBySource(address source)`                  | Public (view)      | Get all token IDs minted by a source contract |

### `AttendancePOAP`

**Inherits:** `NonTransferableERC721`, `IAttendancePOAP`

The concrete implementation. Token IDs start at 1 (zero = "no token" sentinel).

## Token Properties

- **Non-transferable** — Cannot be transferred (inherited from NonTransferableERC721)
- **Global** — One collection per level (festival / session); `sourceContract` identifies which contract issued it
- **Sequential IDs** — Token IDs start at 1 and increment by 1
- **Source-indexed** — `getTokensBySource(source)` lists every token a given Festival or FestivalSession minted

## Dependencies

- `NonTransferableERC721` (nontransferable protocol)
- OpenZeppelin Contracts v5.5.0
