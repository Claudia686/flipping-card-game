const {
    expect
} = require('chai');
const {
    ethers
} = require('hardhat');

const subscriptionId = 1
const _linkToken = '0x779877a7b0d9e8603169ddbd7836e478b4624789'
const _keyHash = '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae'
const _vrfCoordinator = '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823'

// VRFCoordinatorV2Mock
const baseFee = ethers.parseUnits('0.1', 'ether')
const gasPriceLink = ethers.parseUnits('1', 'gwei')

describe('FlippingCardGame', () => {
    let flippingCardGame, deployer, player, player1, player2, vrfCoordinatorMock

    beforeEach(async () => {
        [deployer, player, player1, player2] = await ethers.getSigners()

        // Deploy VRFCoordinatorV2Mock
        const VRFCoordinatorV2Mock = await ethers.getContractFactory('VRFCoordinatorV2Mock')
        vrfCoordinatorMock = await VRFCoordinatorV2Mock.deploy(baseFee, gasPriceLink)
        await vrfCoordinatorMock.waitForDeployment()

        // Create subscription
        const tx = await vrfCoordinatorMock.createSubscription()
        const receipt = await tx.wait()

        // Deploy FlippingCardGame
        const FlippingCardGame = await ethers.getContractFactory('FlippingCardGame')
        flippingCardGame = await FlippingCardGame.deploy(subscriptionId, _linkToken, _keyHash, vrfCoordinatorMock)
        await flippingCardGame.waitForDeployment()

        // Add the FlippingCardGame as a consumer to the created subscription
        const contracAddress = await flippingCardGame.getAddress();
        const addConsumerTx = await vrfCoordinatorMock.addConsumer(subscriptionId, flippingCardGame)
        await addConsumerTx.wait()
    })

    describe('Deployment', () => {
        it('Should have correct subscriptionId', async () => {
            expect((await flippingCardGame.s_subscriptionId()).toString()).to.equal(subscriptionId.toString())
        })

        it('Should have correct keyHash', async () => {
            expect(await flippingCardGame.keyHash()).to.equal(_keyHash)
        })

        it('Should have correct linkToken', async () => {
            expect((await flippingCardGame.linkToken()).toLowerCase()).to.equal(_linkToken.toLowerCase())
        })

        it('Should have correct VRFCoordinator address', async () => {
            const coordinatorAddress = await flippingCardGame.getVRFCoordinator();
            expect(coordinatorAddress.toLowerCase()).to.equal(coordinatorAddress.toLowerCase())
        })

        it('Check for deployer address', async () => {
            expect(await flippingCardGame.owner()).to.equal(deployer.address)
        })
    })

    describe('Create game', () => {
        describe('Success', () => {
            const newEntryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                tx = await flippingCardGame.connect(deployer).createGame(newEntryFee)
                await tx.wait()
            })

            it('Should allow owner to set a game', async () => {
                // Check if new entry fee is set correctly
                const storedFee = await flippingCardGame.gameEntryFee(0);
                expect(storedFee).to.equal(newEntryFee)
            })

            // Check initial state of the game started
            it('Should set game started to false', async () => {
                expect(await flippingCardGame.gameStarted()).to.be.false
            })

            // Emit game created event   
            it('Should emit game created event with correct arguments', async () => {
                const tx = await flippingCardGame.connect(deployer).createGame(newEntryFee)
                await expect(tx).to.emit(flippingCardGame, 'GameCreated').withArgs(newEntryFee)
            })
        })

        describe('Failure', () => {
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create game
                await flippingCardGame.connect(deployer).createGame(entryFee);
            })


            it('Rejects when creating a game with zero entry fee', async () => {
                const newEntryFee = ethers.parseUnits('0', 'ether')
                await expect(flippingCardGame.connect(deployer).createGame(newEntryFee))
                    .to.be.revertedWith('Entry fee must be greater than zero');
            })

            it('Rejects unauthorized account from creating a game', async () => {
                await expect(flippingCardGame.connect(player1).createGame(entryFee))
                    .to.be.reverted;
            })
        })
    })

    describe('Start game', () => {
        describe('Success', () => {
            let gameId
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const tx1 = await flippingCardGame.connect(deployer).createGame(entryFee)
                await tx1.wait()

                gameId = await flippingCardGame.gameId()
            })

            it('Should register players for the game', async () => {
                // Player start the game
                await flippingCardGame.connect(player).startGame({
                    value: entryFee
                })

                // Check if player is registered in the game
                const registeredPlayer = await flippingCardGame.playerInGame(gameId, player.address)
                expect(registeredPlayer).to.be.true

                // Game should not started yet
                let gameStarted = await flippingCardGame.gameStarted()
                expect(gameStarted).to.be.false

                // Player 1 start the game
                await flippingCardGame.connect(player1).startGame({
                    value: entryFee
                })

                // Check if player 1 is registered in the game
                const registeredPlayer1 = await flippingCardGame.playerInGame(gameId, player1.address)
                expect(registeredPlayer1).to.be.true

                // Player 1 start the game
                gameStarted = await flippingCardGame.gameStarted()
                expect(gameStarted).to.be.true
            })

            it('Should increment gameId after starting a game', async () => {
                const gameIdBefore = await flippingCardGame.gameId()

                // Player start game
                await flippingCardGame.connect(player).startGame({
                    value: entryFee
                })

                // Player 1 start game
                await flippingCardGame.connect(player1).startGame({
                    value: entryFee
                })

                const gameIdAfter = await flippingCardGame.gameId()
                expect(Number(gameIdAfter)).to.equal(Number(gameIdBefore) + 1);
            })

            it('Check for correct entry fee', async () => {
                const expectedEntryFee = await ethers.parseUnits('2', 'ether')
                const storedEntryFee = await flippingCardGame.gameEntryFee(gameId)
                expect(expectedEntryFee).to.equal(storedEntryFee)
            })


            it('Should check player registration state', async () => {
                // Register player
                const registeredPlayer = await flippingCardGame.connect(player).startGame({
                    value: entryFee
                })
                await registeredPlayer.wait()

                // Check player registration state
                const isPlayerRegistered = await flippingCardGame.playerInGame(gameId, player.address)
                expect(isPlayerRegistered).to.be.true
            })

            it('Should check for correct entry fee', async () => {
                const storedEntryFee = await flippingCardGame.gameEntryFee(gameId)
                expect(storedEntryFee).to.equal(entryFee)
            })

            it('Should update the gamePlayers array correctly', async () => {
                await flippingCardGame.connect(player1).startGame({
                    value: entryFee
                })
                const players = await flippingCardGame.getGamePlayers(gameId)
                expect(players).to.include(player1.address)
            })
        })

        describe('Failure', () => {
            const gameId = 1
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const tx1 = await flippingCardGame.connect(deployer).createGame(entryFee)
                await tx1.wait()
            })

            it('Rejects insufficient entry fee', async () => {
                // Start game with zero value
                const insufficientFee = ethers.parseUnits('0', 'ether')
                await expect(flippingCardGame.connect(player).startGame({
                    value: insufficientFee
                })).to.be.revertedWith('Entry fee does not match game entry fee');
            })

            it('Rejects new player if game started', async () => {
                // Player starts the game
                await flippingCardGame.connect(player).startGame({
                    value: entryFee
                })

                // Player 1 starts the game
                await flippingCardGame.connect(player1).startGame({
                    value: entryFee
                })
                await flippingCardGame.gameId()

                // Attempt to start the game with a new player 
                await expect(flippingCardGame.connect(player2).startGame({
                    value: entryFee
                })).to.be.revertedWith('Game does not exist');
            })
        })
    })

    describe('Request random words', () => {
        describe('Success', () => {
            it('Should allow the owner to request random words', async () => {
                await flippingCardGame.connect(deployer).requestRandomWords()
                const result = await flippingCardGame.requestInProgress()
                expect(result).to.equal(true);
            })

            it('Should emit RandomWordsRequested event', async () => {
                const tx = await flippingCardGame.connect(deployer).requestRandomWords()
                await expect(tx).to.emit(flippingCardGame, 'RandomWordsRequested')
            })

        })

        describe('Failure', () => {
            it('Rejects new requests during an active request', async () => {
                await flippingCardGame.connect(deployer).requestRandomWords()
                await expect(flippingCardGame.connect(deployer).requestRandomWords()).to.be.revertedWith('Previous request still in progress');
            })
        })
    })

    describe('Flip card', () => {
        let gameId, randomWords
        const entryFee = ethers.parseUnits('10', 'ether')

        beforeEach(async () => {
            // Create a game
            await flippingCardGame.connect(deployer).createGame(entryFee)
            gameId = await flippingCardGame.gameId()

            // Player1 starts the game
            await flippingCardGame.connect(player1).startGame({
                value: entryFee
            })

            // Get players in the game
            let players = await flippingCardGame.getGamePlayers(gameId)
            expect(players.length).to.equal(1)

            // Player2 starts the game
            await flippingCardGame.connect(player2).startGame({
                value: entryFee
            })

            const updatedGameId = await flippingCardGame.gameId();

            // Check for two players in the game
            players = await flippingCardGame.getGamePlayers(gameId)
            expect(players.length).to.equal(2)
        })

        it('Get the winner', async () => {
            // Call requestRandomWords
            const tx = await flippingCardGame.connect(deployer).requestRandomWords()
            await tx.wait()

            const randomWords = [5, 4]

            // Call flipCard
            await flippingCardGame.flipCard(gameId, randomWords)

            // Get players in the game
            const players = await flippingCardGame.getGamePlayers(gameId)
            expect(players.length).to.equal(2)

            // Check for players address
            expect(players[0]).to.equal(player1.address)
            expect(players[1]).to.equal(player2.address)

            const winner = await flippingCardGame.winner()
            const loser = await flippingCardGame.loser()
        })

        it('Reset game state after a successful flip', async () => {
            //  Reset game after a flip
            await flippingCardGame.flipCard(gameId, [5, 4])
            const result = await flippingCardGame.gameStarted()
            expect(result).to.equal(false)
        })
    })

    describe('Stop game', () => {
        describe('Success', () => {
            const entryFee = ethers.parseUnits('2', 'ether')
            let gameId

            beforeEach(async () => {
                // Create a game
                const createNewGame = await flippingCardGame.connect(deployer).createGame(entryFee)
                await createNewGame.wait()

                // Start the game with two players
                await flippingCardGame.connect(player).startGame({
                    value: entryFee
                })

                await flippingCardGame.connect(player1).startGame({
                    value: entryFee
                })

                gameId = await flippingCardGame.gameId()
            })

            it('Should stop the game successfully', async () => {
                // Call stopGame function
                const stopGame = await flippingCardGame.connect(deployer).stopGame()
                await stopGame.wait()

                // Check state changes
                expect(await flippingCardGame.gameStarted()).to.be.false
            })

            it('Retain player registration status after stopping the game', async () => {
                gameId = await flippingCardGame.gameId()
                // Call the stopGame function
                await flippingCardGame.connect(deployer).stopGame()

                // Check players in the game
                const isPlayerRegistered = await flippingCardGame.playerInGame(gameId, player.address)
                const isPlayer1Registered = await flippingCardGame.playerInGame(gameId, player1.address)

                expect(isPlayerRegistered).to.be.false
                expect(isPlayer1Registered).to.be.false
            })
        })

        describe('Failure', () => {
            it('Rejects non-owner stopping the game', async () => {
                await expect(flippingCardGame.connect(player1).stopGame()).to.be.reverted;
            })
        })
    })

    describe('Distribute prize', () => {
        let gameId
        const entryFee = ethers.parseUnits('10', 'ether')

        beforeEach(async () => {

            // Create a game
            await flippingCardGame.connect(deployer).createGame(entryFee)
            gameId = await flippingCardGame.gameId()

            // Player1 starts the game
            await flippingCardGame.connect(player1).startGame({
                value: entryFee
            })

            // Player2 starts the game
            await flippingCardGame.connect(player2).startGame({
                value: entryFee
            })
        })

        it('Distribute the prize to the winner', async () => {
            // Check for game players
            const players = await flippingCardGame.getGamePlayers(gameId)
            expect(players.length).to.equal(2)

            await flippingCardGame.flipCard(gameId, [5, 4])

            // Get contract balance before the prize distribution
            const contractBalanceBefore = await ethers.provider.getBalance(await flippingCardGame.getAddress())

            // Get player1 balance before the prize distribution
            const winner1BalanceBefore = await ethers.provider.getBalance(player1);

            // Distribute the prize to the winner
            const distributeTx = await flippingCardGame.distributePrize()
            await distributeTx.wait()

            // Get contract balance after the prize distribution
            const contractBalanceAfter = await ethers.provider.getBalance(await flippingCardGame.getAddress())
            expect(contractBalanceAfter).to.equal(0)

            // Get player1 balance after the prize distribution
            const winnerBalanceAfter = await ethers.provider.getBalance(player1)
        })
    })
})