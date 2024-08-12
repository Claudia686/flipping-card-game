// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FlippingCardGame is VRFConsumerBaseV2, Ownable {
    bool public gameStarted;
	uint public entryFee;
	uint public gameId;
    bool public requestInProgress;
  
  mapping(address => Player) public players;
  mapping(uint => address[]) public gamePlayers;
  mapping(uint => uint) public gameEntryFee;
  mapping(uint => mapping(address => bool)) public playerInGame;
  mapping(uint => bool) public gameIsStopped;

  event GameCreated(uint gameId, uint entryFee);
  event GameInitiated(uint gameId, uint entryFee);
  event GameStopped(uint gameId);

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
    uint32 public callbackGasLimit = 150000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 2;
    uint256 public randomWordsNum1; 
    uint256 public randomWordsNum2; 
 
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
    requestInProgress = false;
   }

    function createGame(uint _gameId, uint _entryFee) public onlyOwner {
        // Entry fee check
        require(_entryFee != 0, 'Entry fee must be greater than zero');

        // Game ID check
        require(gameEntryFee[_gameId] == 0, 'Game ID already exists');

        // Set the entry fee state variable
        entryFee = _entryFee; 

        // Update the mapping with the new game ID and entry fee
        gameEntryFee[_gameId] = _entryFee; 

        // Set isStopped to false
        gameIsStopped[_gameId] = false;

        // Update the gameId state variable to the new game ID
        gameId = _gameId;

        // Emit the GameCreated event
        emit GameCreated(_gameId, _entryFee);
    }

    function startGame(uint _gameId, uint _entryFee) public payable {
        // Check if game exist       
        require(gameEntryFee[_gameId] > 0, 'Game does not exist');

        // Ensure sent value matches stored entry fee        
        require(msg.value == gameEntryFee[_gameId], 'Entry fee does not match game entry fee');

        // Check if the game is stopped
        require(!gameIsStopped[_gameId], 'Game has been stopped');

        // Check if player is not already registered
        require(!playerInGame[gameId][msg.sender], ('Player is already registered in the game'));

        // Add the player to the game
        gamePlayers[_gameId].push(msg.sender);

          // Mark the player as registered
        playerInGame[gameId][msg.sender] = true;

        // Ensure no other game is currently in progress        
        require(!gameStarted, 'Game has already started');

        // Check if there are enough players to start the game
    if (gamePlayers[_gameId].length == 2) {
        // Change game state to true
        gameStarted = true;

        // Emit event
        emit GameInitiated(_gameId, gameEntryFee[_gameId]);

        // Increment the game ID for the next game
        gameId++;
    }
}
    function getGamePlayers(uint _gameId) public view returns (address[] memory) {
        return gamePlayers[_gameId];
    }

    function stopGame(uint _gameId) public onlyOwner {
        // Check if game is started
        require(gameStarted, 'Game is not started');

        // Check if the game is already stopped
        require(!gameIsStopped[_gameId], 'Game is already stopped');

        // Update gameIsStopped State
        gameIsStopped[_gameId] = true;

        // Update gameStarted state
        gameStarted = false;

        // Emit an event
        emit GameStopped(_gameId); 
    }

    function requestRandomWords() external onlyOwner {
        require(!requestInProgress, 'Previous request still in progress');

        uint256 requestId = COORDINATOR.requestRandomWords(
        keyHash,             
        s_subscriptionId,    
        requestConfirmations, 
        callbackGasLimit,     
        numWords    
      );
        require(requestId > 0, "Request ID should be valid");
        requestInProgress = true;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override { 
        randomWordsNum = randomWords [0];
        emit RequestFulFill(requestId, randomWords);
    }

     function getVRFCoordinator() public view returns (address) {
        return address(COORDINATOR);
     }
}

