// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import "../nontransferable/NonTransferableERC721.sol";
import "./IAttendancePOAP.sol";

/// @title AttendancePOAP: Proof of Attendance NFT
/// @notice Global soulbound ERC-721 POAP collection. Two instances per festival
/// deployment: one for festival-level POAPs, one for sub-event-level POAPs.
contract AttendancePOAP is NonTransferableERC721, IAttendancePOAP {
    address public factory;
    uint256 private _nextTokenId = 1; // Token ID 0 reserved as no-token sentinel

    mapping(address => bool) public isAuthorizedMinter;
    mapping(uint256 => POAPData) public poapData;

    mapping(address => uint256[]) private _sourceToTokenIds; // reverse index

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyAuthorizedMinter() {
        if (!isAuthorizedMinter[msg.sender]) revert OnlyAuthorizedMinter();
        _;
    }

    constructor(address _factory) NonTransferableERC721("Conference POAP", "POAP") {
        factory = _factory;
    }

    // ── Factory Management ──

    /// @notice Transfer factory rights to a new address (e.g., from deployer EOA to Festival contract)
    function transferFactory(address newFactory) external onlyFactory {
        address previous = factory;
        factory = newFactory;
        emit FactoryTransferred(previous, newFactory);
    }

    /// @notice Permanently renounce factory rights. No further minter management possible.
    function renounceFactory() external onlyFactory {
        address previous = factory;
        factory = address(0);
        emit FactoryRenounced(previous);
    }

    // ── Minter Management ──

    function authorizeMinter(address minter) external onlyFactory {
        if (isAuthorizedMinter[minter]) revert AlreadyAuthorized();
        isAuthorizedMinter[minter] = true;
        emit MinterAuthorized(minter);
    }

    function revokeMinter(address minter) external onlyFactory {
        if (!isAuthorizedMinter[minter]) revert NotAuthorized();
        isAuthorizedMinter[minter] = false;
        emit MinterRevoked(minter);
    }

    // ── Minting ──

    function mintPOAP(
        address attendee,
        address sourceContract
    ) external onlyAuthorizedMinter returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(attendee, tokenId);

        poapData[tokenId] = POAPData({
            sourceContract: sourceContract,
            attendee: attendee,
            issuedAt: uint64(block.timestamp)
        });

        _sourceToTokenIds[sourceContract].push(tokenId);

        emit POAPMinted(tokenId, attendee, sourceContract);
    }

    // ── Views ──

    function getPOAPData(uint256 tokenId) external view returns (POAPData memory) {
        _requireOwned(tokenId);
        return poapData[tokenId];
    }

    function getTokensBySource(address sourceContract) external view returns (uint256[] memory) {
        return _sourceToTokenIds[sourceContract];
    }
}
