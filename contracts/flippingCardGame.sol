 // SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FlippingCardGame is VRFConsumerBaseV2, Ownable {
    bool public gameStarted;
	uint256 public entryFee;
	uint256 public gameId;
    bool public requestInProgress;
    address public winner;
    address public loser;
    bool public prizeDistributed;

    mapping(address => Player) public players;
    mapping(uint256 => address[]) public gamePlayers;
    mapping(uint256 => uint256) public gameEntryFee;
    mapping(uint256 => mapping(address => bool)) public playerInGame;
    mapping(uint256 => bool) public gameIsStopped;
    mapping(uint256 => mapping(address => bool)) public distributor;
    mapping(uint256 => mapping(address => uint256)) public gamePrizes;
    mapping(uint256 => uint256) public requestIdToGameId;

    struct Player {
    address playerAddress; // The address of the player
    uint256 gameId;  // The ID of the game
    uint256 entryFee; // The entry fee paid by the player
    } 

    event GameCreated(uint256 entryFee);
    event RandomWordsRequested(uint256 indexed requestId);
    event PrizeDistributed(address indexed winner, uint256 totalPrize, uint256 indexed gameId);

    // Chainlink VRF parameters
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 public s_subscriptionId;
    bytes32 public keyHash;
    address public linkToken;
    uint32 public callbackGasLimit = 150000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 2;

    constructor (
        uint64  subscriptionId,
        address _linkToken,
        bytes32 _keyHash,
        address _vrfCoordinator
    )

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

function requestRandomWords() external onlyOwner {
    // Restrict to one request at a time
    require(!requestInProgress, 'Previous request still in progress');
    uint256 requestId = COORDINATOR.requestRandomWords(
        keyHash,             
        s_subscriptionId,    
        requestConfirmations, 
        callbackGasLimit,     
        numWords    
    );

    requestInProgress = true;
    require(requestId != 0, 'Request ID should not be zero');
    requestIdToGameId[requestId] = gameId;
    emit RandomWordsRequested(requestId);
}

function distributePrize() external {
    // Verify caller is the winner
    require(msg.sender == winner, 'Only the winner can access the funds');
    // Ensure prize not claimed yet
    require(!distributor[gameId][msg.sender], 'Prize already completed by this address');    
    // Ensure prize not assigned
    require(gamePrizes[gameId][winner] == 0, 'Prize already assigned to this address');

    // Get the total available funds in the contract
    uint256 totalPrize = address(this).balance;
    // Check funds available
    require(totalPrize > 0, 'No funds to transfer');

    // Mark prize as claimed
    distributor[gameId][msg.sender] = true; 
    // Update the totalPrize
    gamePrizes[gameId][winner] = totalPrize; 
    // Mark as distributed
    prizeDistributed = true; 

    // Transfer funds to the winner
    (bool success, ) = payable(winner).call{value: totalPrize}('');
    require(success, 'Transfer failed');

    // Emit prize distributed event
    emit PrizeDistributed(winner, totalPrize, gameId);
}
 
function createGame(uint256 _entryFee) public onlyOwner {
    // Check if a request is in progress
    require(!requestInProgress, 'Cannot start a new game while a request is in progress');
    // Entry fee check
    require(_entryFee != 0, 'Entry fee must be greater than zero');
    gameEntryFee[gameId] = _entryFee;

    // Set the entry fee state variable
    entryFee = _entryFee; 
    gameStarted = false;
    // Emit GameCreated event
    emit GameCreated( _entryFee);
}

function joinGame() public {
    // Check if player is not already registered
    require(!playerInGame[gameId][msg.sender], ('Player is already registered in the game'));
    // Add the player to the game
    gamePlayers[gameId].push(msg.sender);
    require(!gameStarted, 'Game has already started');
    // Mark the player as registered
    playerInGame[gameId][msg.sender] = true;
}

function startGame() public payable {
    // Check if the game exist       
    require(gameEntryFee[gameId] > 0, 'Game does not exist');
    // Ensure sent value matches stored entry fee        
    require(msg.value == gameEntryFee[gameId], 'Entry fee does not match game entry fee');
    // Ensure no other game is currently in progress        
    require(!gameStarted, 'Game has already started');
    // Check if the game is stopped
    require(!gameIsStopped[gameId], 'Game has been stopped');
    require(gamePlayers[gameId].length == 2, 'Two players are required to start the game');
  
    if (gamePlayers[gameId].length == 2) {
        // Change game state to true
        gameStarted = true;
        // Increment the game ID for the next game
        gameId++;
    }
}

function stopGame() public onlyOwner {
    // Check if game is started
    require(gameStarted, 'Game is not started');
    // Check if the game is already stopped
    require(!gameIsStopped[gameId], 'Game is already stopped');
    playerInGame[gameId][msg.sender] = true;
    // Update gameStarted state
    gameStarted = false;

    for (uint i = 0; i < gamePlayers[gameId].length; i++) {
        address player = gamePlayers[gameId][i];
        playerInGame[gameId][player] = false;
    }
}

function getGamePlayers(uint256 _gameId) public view returns (address[] memory) {
    return gamePlayers[_gameId];
}

function getVRFCoordinator() public view returns (address) {
    return address(COORDINATOR);
}  

function flipCard(uint256 _gameId, uint256[] memory randomWords) internal {     
    require(gamePlayers[_gameId].length == 2,'Incorrect number of players for the game');
    // Retrieve player addresses from the current game
    address player1 = gamePlayers[_gameId][0];
    address player2 = gamePlayers[_gameId][1];

    // Map random words to values between 1 and 10
    uint256 randomValue1 = (randomWords[0] % 10) + 1;
    uint256 randomValue2 = (randomWords[1] % 10) + 1;

    // Determine the winner and loser
    if (randomValue1 > randomValue2) {
        winner = player1;
        loser = player2; 
        } else {
            winner = player2;
            loser = player1;
        }

    // Mark the game as finished 
    gameStarted = false; 
}

function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override { 
    uint256 gameIdForRequest = requestIdToGameId[requestId];
    flipCard(gameIdForRequest, randomWords);
    requestInProgress = false;
}
}


