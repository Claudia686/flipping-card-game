 // SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol"; 
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol"; 
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol"; 
import "@openzeppelin/contracts/access/Ownable.sol"; 
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol"; 

contract FlippingCardGame is VRFConsumerBaseV2, Ownable {
    bool public gameStarted;
	uint256 public entryFee;
	uint256 public gameId;
    bool public requestInProgress;
    address public winner;
    address public loser;
    bool public prizeDistributed;
    uint256 public requestId;

    /**
     * @dev players:
     * @notice Maps each player's address to their respective Player struct.
     * 
     * @dev gamePlayers:
     * @notice Maps each game ID to the list of players' addresses participating in that game.
     * 
     * @dev gameEntryFee:
     * @notice Maps each game ID to its entry fee.
     * 
     * @dev playerInGame:
     * @notice Maps each game ID and player address to whether the player has joined the game.
     */
    mapping(address => Player) public players;
    mapping(uint256 => address[]) public gamePlayers;
    mapping(uint256 => uint256) public gameEntryFee;
    mapping(uint256 => mapping(address => bool)) public playerInGame;

    /**
     * * @dev gameIsStopped:
     * @notice Maps each game ID to a boolean indicating if the game is stopped.
     * 
     * @dev distributor:
     * @notice Tracks prize distribution status for each player and game.
     * 
     * @dev gamePrizes:
     * @notice Maps each game ID to the prize amount for a specific player.
     * 
     * @dev requestIdToGameId:
     * @notice Links VRF request IDs to game IDs for tracking.
     */
    mapping(uint256 => bool) public gameIsStopped;
    mapping(uint256 => mapping(address => bool)) public distributor;
    mapping(uint256 => mapping(address => uint256)) public gamePrizes;
    mapping(uint256 => uint256) public requestIdToGameId;
    
    /**
     * @notice Stores information about each player in the game.
     * @dev Tracks player-specific details, including their address, game ID, and entry fee.
     */
    struct Player {
    address playerAddress; 
    uint256 gameId;  
    uint256 entryFee; 
    } 

    /**
     * @dev Emit GameCreated event with entry fee.
     * @dev Emit RandomWordsRequested event with request ID.
     * @dev Emit PrizeDistributed event with winner address, totalPrize and game ID.
     */
    event GameCreated(uint256 entryFee);
    event RandomWordsRequested(uint256 indexed requestId);
    event PrizeDistributed(address indexed winner, uint256 totalPrize, uint256 indexed gameId);

    /**
     * @notice Defines configuration parameters for Chainlink VRF to generate randomness in games.
     * @dev Includes subscription ID, gas limit, number of confirmations, and other randomness settings.
     */
    VRFCoordinatorV2Interface COORDINATOR;
    VRFCoordinatorV2_5Mock public s_vrfCoordinator;
    uint256 public s_subscriptionId;
    bytes32 public keyHash;
    address public linkToken;
    uint32 public callbackGasLimit = 150000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 2;

    /**
     * @notice Initializes Chainlink VRF parameters and sets initial state variables.
     * @param subscriptionId The Chainlink VRF subscription ID.
     * @param _linkToken The address of the Chainlink token contract.
     * @param _keyHash The key hash used for Chainlink VRF.
     * @param _vrfCoordinator The address of the Chainlink VRF coordinator contract.
     */
    constructor (
        uint256  subscriptionId,
        address _linkToken,
        bytes32 _keyHash,
        address _vrfCoordinator
    )

    /**
     * @notice Initializes the contract with Chainlink VRF parameters and the initial game state.
     * @dev Sets the subscription ID, key hash, LINK token address, VRF coordinator, 
     * and initializes the game state.
     */
    VRFConsumerBaseV2(_vrfCoordinator) 
    Ownable(msg.sender) {
    s_subscriptionId = subscriptionId;
    keyHash = _keyHash;
    linkToken = _linkToken;
    s_vrfCoordinator = VRFCoordinatorV2_5Mock(_vrfCoordinator);
    gameStarted = false;
    requestInProgress = false;
    }

    /**
     * @notice Initiates a request for random words from Chainlink VRF; callable only by the contract owner.
     * @dev Ensures a single VRF request at a time and verifies entry fee is set.
     */
    function requestWords() external onlyOwner {
          VRFV2PlusClient.ExtraArgsV1 memory extraArgsStruct = VRFV2PlusClient.ExtraArgsV1({
            nativePayment: false
        });

    bytes memory extraArgs = abi.encodeWithSelector(
        VRFV2PlusClient.EXTRA_ARGS_V1_TAG, 
        extraArgsStruct
    );

        VRFV2PlusClient.RandomWordsRequest memory _req = VRFV2PlusClient.RandomWordsRequest({
        keyHash: keyHash,
        subId: s_subscriptionId,
        requestConfirmations: requestConfirmations,
        callbackGasLimit: callbackGasLimit,
        numWords: numWords,
        extraArgs: extraArgs
    });
        uint256 requestId = s_vrfCoordinator.requestRandomWords(_req);
        requestIdToGameId[requestId] = gameId;
        requestInProgress = true;
        emit RandomWordsRequested(requestId);
    }

    /**
     * @notice Distributes the prize to the winner.
     * @dev Ensures only the winner can claim and prize distribution status is updated.
     */
    function distributePrize() external {
        require(msg.sender == winner, 'FlippingCardGame: Only the winner can access the funds');
        require(!distributor[gameId][msg.sender], 'FlippingCardGame: Prize already completed by this address');    
        require(gamePrizes[gameId][winner] == 0, 'FlippingCardGame: Prize already assigned to this address');
        uint256 totalPrize = address(this).balance;
        require(totalPrize > 0, 'FlippingCardGame: No funds to transfer');
        distributor[gameId][msg.sender] = true; 
        gamePrizes[gameId][winner] = totalPrize; 
        prizeDistributed = true; 
        (bool success, ) = payable(winner).call{value: totalPrize}('');
        require(success, 'FlippingCardGame: Transfer failed');
        emit PrizeDistributed(winner, totalPrize, gameId);
    }

    /**
     * @notice Creates a new game with a specified entry fee; callable only by the contract owner.
     * @param _entryFee The entry fee for joining the game.
     */
    function createGame(uint256 _entryFee) public onlyOwner {
        require(!requestInProgress, 'FlippingCardGame: Cannot start a new game while a request is in progress');
        require(_entryFee != 0, 'FlippingCardGame: Entry fee must be greater than zero');
        gameEntryFee[gameId] = _entryFee;
        entryFee = _entryFee; 
        gameStarted = false;
        emit GameCreated(_entryFee);
    }

    /**
     * @notice Allows a player to join an active game.
     */
    function joinGame() public {
        require(!playerInGame[gameId][msg.sender], 'FlippingCardGame: Player is already registered in the game');
        gamePlayers[gameId].push(msg.sender);
        require(!gameStarted, 'FlippingCardGame: Game has already started');
        playerInGame[gameId][msg.sender] = true;
    }

    /**
     * @notice Starts the game if the conditions are met (e.g., exactly two players, entry fee paid).
     */
    function startGame() public payable {
        require(gameEntryFee[gameId] > 0, 'FlippingCardGame: Game does not exist');
        require(msg.value == gameEntryFee[gameId], 'FlippingCardGame: Entry fee does not match game entry fee');
        require(!gameStarted, 'FlippingCardGame: Game has already started');
        require(!gameIsStopped[gameId], 'FlippingCardGame: Game has been stopped');
        require(gamePlayers[gameId].length == 2, 'FlippingCardGame: Two players are required to start the game');
        if (gamePlayers[gameId].length == 2) {
            gameStarted = true;
            gameId++;
        }
    }

    /**
     * @notice Stops an active game; callable only by the contract owner.
     */
    function stopGame() public onlyOwner {
        require(gameStarted, 'FlippingCardGame: Game is not started');
        require(!gameIsStopped[gameId], 'FlippingCardGame: Game is already stopped');
        playerInGame[gameId][msg.sender] = true;
        gameStarted = false;
        for (uint i = 0; i < gamePlayers[gameId].length; i++) {
            address player = gamePlayers[gameId][i];
            playerInGame[gameId][player] = false;
        }
    }

    /**
     * @notice Returns the list of players for a given game.
     * @param _gameId The ID of the game for which players are being queried.
     * @return An array of player addresses in the specified game 
     */
    function getGamePlayers(uint256 _gameId) public view returns (address[] memory) {
        return gamePlayers[_gameId];
    }

    /**
     * @notice Determines the winner of a game by comparing random values derived from Chainlink VRF.
     * @dev Uses two random words to assign values between 1 and 10, 
     * with the higher value determining the winner.
     * @param _gameId The ID of the game being played.
     *  @param randomWords An array of random numbers supplied by Chainlink VRF.
     */
    function flipCard(uint256 _gameId, uint256[] memory randomWords) internal {     
        require(gamePlayers[_gameId].length == 2, 'FlippingCardGame: Incorrect number of players for the game');
        address player1 = gamePlayers[_gameId][0];
        address player2 = gamePlayers[_gameId][1];
        uint256 randomValue1 = (randomWords[0] % 10) + 1;
        uint256 randomValue2 = (randomWords[1] % 10) + 1;
        if (randomValue1 > randomValue2) {
            winner = player1;
            loser = player2; 
        } else {
            winner = player2;
            loser = player1;
        }
        gameStarted = false; 
    }
    
    /**
     * @notice Chainlink VRF callback function to fulfill random words.
     * @param requestId The ID of the VRF request.
     * @param randomWords Array of random words provided by VRF.
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override { 
        uint256 gameIdForRequest = requestIdToGameId[requestId];
        flipCard(gameIdForRequest, randomWords);
        requestInProgress = false;
    }
}

