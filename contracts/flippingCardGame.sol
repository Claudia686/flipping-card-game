// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FlippingCardGame is VRFConsumerBaseV2, Ownable {
    bool public gameStarted;
	uint public entryFee;
	uint public gameId;
  
  mapping(address => Player) public players;
  mapping(uint => address[]) public gamePlayers;
  mapping(uint => uint) public gameEntryFee;

  event RequestFulFill(uint256 requestId, uint256[] randomWords);
  event GameCreated(uint gameId, uint entryFee);

  struct Player {
    address playerAddress; // The address of the player
    uint gameId;  // The ID of the game
    uint entryFee; // The entry fee paid by the player
 }


// Chainlink VRF parameters
VRFCoordinatorV2Interface COORDINATOR;
    uint64 public s_subscriptionId;
    bytes32 public keyHash;
    address public linkToken;
    uint64 public callbackGasLimit = 150000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    uint public randomWordsNum; // Select a winner

constructor (
    uint64  subscriptionId,
    address _linkToken,
    bytes32 _keyHash,
    address _vrfCoordinator
  )

// Initialize the VRFConsumerBaseV2 with the VRF coordinator address
VRFConsumerBaseV2(_vrfCoordinator) 
    Ownable(msg.sender) {

// Initialize Chainlink VRF parameters	
    s_subscriptionId = subscriptionId;
    keyHash = _keyHash;
    linkToken = _linkToken;
    COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
       gameStarted = false;
   }

    function createGame(uint _gameId, uint _entryFee) public onlyOwner {
        // Entry fee check
        require(_entryFee != 0, "Entry fee must be greater than zero");
        // Game ID check
        require(gameEntryFee[_gameId] == 0, "Game ID already exists");
        // Game started check
        require(!gameStarted, "Game has already started");

        // Set the entry fee state variable
        entryFee = _entryFee; 

        // Update the mapping with the new game ID and entry fee
        gameEntryFee[_gameId] = _entryFee; 

        // Update the gameId state variable to the new game ID
        gameId = _gameId; 
        
        // Emit the GameCreated event
        emit GameCreated(_gameId, _entryFee);
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override { 
    	randomWordsNum = randomWords [0];
    	emit RequestFulFill(requestId, randomWords);
    }

     function getVRFCoordinator() public view returns (address) {
        return address(COORDINATOR);
    }
}



