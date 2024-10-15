### Flipping Card Game
# Implements a simple card flipping game using Chainlink VRF for randomness. 
# Players join by paying an entry fee, and the winner is determined based on random numbers.

## Key Features:
# Game Creation: The owner creates games with a set entry fee.
# Player Participation: Two players join by paying the entry fee.
# Randomness: Chainlink VRF generates random numbers to determine the winner.
# Prize Distribution: The winner receives the combined entry fees.

## Main functions
# createGame: 
Creates a new game.

# startGame: 
Players join the game.

# getGamePlayers: 
Returns the list of players in a specific game.

# stopGame: 
Allows the owner to stop an ongoing game.

# requestRandomWords: 
Requests randomness.

# fulfillRandomWords: 
Callback function that receives and stores the random numbers from Chainlink VRF.

# flipCard: 
Determines the winner.

# distributePrize: 
Transfers the prize to the winner.

## Available Scripts
# In the project directory, you can run: npx hardhat run scripts/deploy.js --network hardhat.

## Running the frontend
# In the project directory, you can run: npm start
Runs the app in the development mode.
Open http://localhost:3000 to view it in your browser.

---

# Mishandling Rewards

# Contest Summary 
Date: October 15th 2024

# Results Summary
Number of findings:
High: 1
Medium: 
Low: 0

# High Risk Findings
H-01. Unauthorized rewards.

---

## Summary
The DistributePrize function is vulnerable due to missing validation, risking rewards being claimed by unauthorized users.

## Vulnerability Details:
The DistributePrize function does not properly verify the winner, allowing unauthorized users to claim rewards meant for the actual winner. 

## POC
``` solidity
function distributePrize() external {
        uint256 totalPrize = address(this).balance;
        // Ensure there are funds to transfer
        require(totalPrize > 0, 'No funds to transfer');
        // Transfer the total prize to the winner
        (bool success, ) = payable(winner).call{value: totalPrize}('');
        // Check if the transfer was successful
        require(success, 'Transaction failed');
     } 
```
## Impact
*Scenario 1:*
Player 1 deposits 1 ETH to join the game, but Player 2 cancels the game and withdraws Player 1's funds.
*Scenario 2:*
Player 2 claims rewards from the DistributePrize function, stealing the prize intended for the actual game winner.

## Tools Used
### Sublime Text, Hardhat

## Recommendations  
 Add a new mapping: 
``` solidity

mapping(uint256 => mapping(address => bool)) public distributor;

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
```

---


# Mismatch for requestId 

# Contest Summary 
Date: October 15th 2024

# Results Summary
Number of findings:
High: 0
Medium: 1 
Low: 0

# High Risk Findings
H-02. Mismatch between requestId and gameId causing unauthorized rewards.

---

## Summary
The fulfillRandomWords function mishandles the link between requestId and gameId, causing incorrect game outcomes and potential unfair rewards.

## Vulnerability Details:
The requestId in the fulfillRandomWords function does not map directly to the correct gameId, allowing random numbers to be applied to the wrong game, potentially leading to incorrect results and unauthorized rewards. 

## POC
``` solidity
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override { 
        randomWordsNum = randomWords [0];
        emit RequestFulFill(requestId, randomWords);
```
## Impact
*Case 1:* 
Random numbers intended for Player 2’s game are mistakenly applied to Player 1’s game, resulting in unintended and potentially unfair game outcomes.
*Case 2:*
Player 2 manipulates the system by exploiting the mismatch, causing incorrect random results to be used in Player 1’s game and unfairly winning rewards.

## Tools Used
### Sublime Text, Hardhat

## Recommendations  
 Add a new mapping to ensure requestId is correctly associated with gameId:
```solidity
mapping(uint256 => uint256) public requestIdToGameId;

function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override { 
    uint256 gameIdForRequest = requestIdToGameId[requestId];
    flipCard(gameIdForRequest, randomWords);
    requestInProgress = false;
```