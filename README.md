# Flipping Card Game
## Overview
This project implements a card-flipping game that leverages Chainlink VRF for randomness. 
Key features include:

- Game Creation: 
The owner can create games with a defined entry fee

- Player Participation: 
Two players join the game by paying the specified entry fee.

- Randomness:
Chainlink VRF provides unbiased random numbers to fairly determine the winner

- Prize Distribution: 
The combined entry fees are awarded to the winner

### createGame
Creates a new game

### startGame
Players join the game

### getGamePlayers
Returns the list of players in a specific game

### stopGame
Allows the owner to stop an ongoing game

### requestRandomWords
Requests randomness

### fulfillRandomWords
Callback function that receives and stores the random numbers from Chainlink VRF

### flipCard
Determines the winner

### distributePrize
Transfers the prize to the winner
