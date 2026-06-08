// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/protocols/poap/AttendancePOAP.sol";
import "../src/apps/events/Festival.sol";

/// @title DeployFestival: Deploys a single festival with both POAP contracts
/// @notice V1 deployment: deploy contracts + optional setup() + wiring
contract DeployFestival is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy both POAP contracts (deployer is the factory/owner)
        AttendancePOAP festivalPoap = new AttendancePOAP(deployer);
        AttendancePOAP sessionPoap = new AttendancePOAP(deployer);

        // 2. Deploy Festival (4-param constructor)
        Festival festival = new Festival(
            deployer,
            address(festivalPoap),
            address(sessionPoap),
            true // subEventsEnabled
        );

        // 3. Authorize Festival as minter on festival-level POAP
        festivalPoap.authorizeMinter(address(festival));

        // 4. Transfer session POAP factory rights to Festival
        //    (Festival needs to authorize each session as a minter)
        sessionPoap.transferFactory(address(festival));

        // 5. Optionally call setup() + wiring if env vars provided
        bytes32 metadataCid = vm.envOr("METADATA_CID", bytes32(0));
        if (metadataCid != bytes32(0)) {
            bytes32 channelMetadataCid = vm.envOr("CHANNEL_METADATA_CID", bytes32(0));
            require(
                channelMetadataCid != bytes32(0),
                "Deploy: CHANNEL_METADATA_CID is required when METADATA_CID is set. Upload the initial channel JSON to Bulletin first."
            );
            uint32 capacity = uint32(vm.envUint("CAPACITY"));
            uint64 startTime = uint64(vm.envUint("START_TIME"));
            uint64 endTime = uint64(vm.envUint("END_TIME"));

            festival.setup(metadataCid, channelMetadataCid, startTime, endTime, capacity);
        }

        vm.stopBroadcast();

        console.log("Festival POAP:", address(festivalPoap));
        console.log("Session POAP:", address(sessionPoap));
        console.log("Festival:", address(festival));
    }
}
