// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

interface IAttendancePOAP {
    struct POAPData {
        address sourceContract;
        address attendee;
        uint64 issuedAt;
    }

    // Minting events
    event POAPMinted(uint256 indexed tokenId, address indexed attendee, address indexed sourceContract);
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);

    // Factory management events
    event FactoryTransferred(address indexed previousFactory, address indexed newFactory);
    event FactoryRenounced(address indexed previousFactory);

    // Factory management
    function transferFactory(address newFactory) external;
    function renounceFactory() external;

    // Minter management (factory only)
    function authorizeMinter(address minter) external;
    function revokeMinter(address minter) external;

    // Minting (authorized minters only)
    function mintPOAP(address attendee, address sourceContract) external returns (uint256 tokenId);

    // Views
    function getPOAPData(uint256 tokenId) external view returns (POAPData memory);
    function getTokensBySource(address sourceContract) external view returns (uint256[] memory);

    // Errors
    error OnlyFactory();
    error OnlyAuthorizedMinter();
    error AlreadyAuthorized();
    error NotAuthorized();
}
