// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// State veriable
contract FlippingCardGame is VRFConsumerBaseV2, Ownable {
    bool public gameStarted;
	uint public entryFee;
	uint public gameId;

struct Player {
    address playerAddress; // The address of the player
  	uint gameId;  // The ID of the game
  	uint entryFee; // The entry fee paid by the player
}

  mapping(address => Player) public players;
  mapping(uint => address[]) public gamePlayers;
  mapping(uint => uint) public gameEntryFee;

 // Chainlink VRF parameters
VRFCoordinatorV2Interface COORDINATOR;
    uint64 public s_subscriptionId;
    bytes32 public keyHash;
    address public linkToken;
    uint64 public callbackGasLimit = 150000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    uint public randomWordsNum; // Select a winner.

constructor (
    uint64 subscriptionId,
    address _linkToken,
    bytes32 _keyHash,
    address _vrfCoordinator
  )

// Initialize the VRFConsumerBaseV2 with the VRF coordinator address
VRFConsumerBaseV2(_vrfCoordinator) 
    Ownable(msg.sender)
    {

// Initialize Chainlink VRF parameters	
    s_subscriptionId = subscriptionId;
    keyHash = _keyHash;
    linkToken = _linkToken;
    COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);

    // Initialize game settings
    gameStarted = false;
    }
}

