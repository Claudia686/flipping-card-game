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




