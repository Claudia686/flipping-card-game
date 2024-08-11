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
            const gameId = 1
            const newEntryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                tx = await flippingCardGame.connect(deployer).createGame(gameId, newEntryFee)
                await tx.wait()
            })

            it('Should allow owner to set a game', async () => {
                // Check if new entry fee is set correctly
                const storedFee = await flippingCardGame.gameEntryFee(gameId);
                expect(storedFee).to.equal(newEntryFee)
            })

            // Check initial state of the game started
            it('Should set game started to false', async () => {
                expect(await flippingCardGame.gameStarted()).to.be.false
            })

            // Emit game created event   
            it('Should emit game created event with correct arguments', async () => {
                const gameId = 2
                const tx = await flippingCardGame.connect(deployer).createGame(gameId, newEntryFee)
                await expect(tx).to.emit(flippingCardGame, 'GameCreated').withArgs(gameId, newEntryFee)
            })
        })

        describe('Failure', () => {
            const gameId = 1
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create game
                await flippingCardGame.connect(deployer).createGame(gameId, entryFee);
            })

            it('Should revert on duplicate game ID', async () => {
                // Check to revert if game id exist
                await expect(flippingCardGame.connect(deployer).createGame(gameId, entryFee))
                    .to.be.revertedWith('Game ID already exists');
            })

            it('Rejects when creating a game with zero entry fee', async () => {
                const newEntryFee = ethers.parseUnits('0', 'ether')
                await expect(flippingCardGame.connect(deployer).createGame(gameId, newEntryFee))
                    .to.be.revertedWith('Entry fee must be greater than zero');
            })

            it('Rejects unauthorized account from creating a game', async () => {
                await expect(flippingCardGame.connect(player1).createGame(gameId, entryFee))
                    .to.be.reverted;
            })
        })
    })

    describe('Start game', () => {
        describe('Success', () => {
            const gameId = 1
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const tx1 = await flippingCardGame.connect(deployer).createGame(gameId, entryFee)
                await tx1.wait()
            })

            it('Should register players for the game', async () => {
                // Player start the game
                await flippingCardGame.connect(player).startGame(gameId, entryFee, {
                    value: entryFee
                })

                // Check if player is registered in the game
                const registeredPlayer = await flippingCardGame.playerInGame(gameId, player.address)
                expect(registeredPlayer).to.be.true

                // Game should not started yet
                let gameStarted = await flippingCardGame.gameStarted()
                expect(gameStarted).to.be.false

                // Player 1 start the game
                await flippingCardGame.connect(player1).startGame(gameId, entryFee, {
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
                await flippingCardGame.connect(player).startGame(gameId, entryFee, {
                    value: entryFee
                })

                // Player 1 start game
                await flippingCardGame.connect(player1).startGame(gameId, entryFee, {
                    value: entryFee
                })

                const gameIdAfter = await flippingCardGame.gameId()
                expect(gameIdAfter).be.equal(2)
            })

            it('Check for correct entry fee', async () => {
                const expectedEntryFee = await ethers.parseUnits('2', 'ether')
                const storedEntryFee = await flippingCardGame.gameEntryFee(gameId)
                expect(expectedEntryFee).to.equal(storedEntryFee)
            })

            it('Should emit game Initiated event with correct arguments', async () => {
                const tx1 = await flippingCardGame.connect(player).startGame(gameId, entryFee, {
                    value: entryFee
                })
                await tx1.wait()

                const tx2 = await flippingCardGame.connect(player1).startGame(gameId, entryFee, {
                    value: entryFee
                })
                await tx2.wait()

                await expect(tx2).to.emit(flippingCardGame, 'GameInitiated').withArgs(gameId, entryFee);
            })

            it('Should check player registration state', async () => {
                // Register player
                const registeredPlayer = await flippingCardGame.connect(player).startGame(gameId, entryFee, {
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
                await flippingCardGame.connect(player1).startGame(gameId, entryFee, {
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
                const tx1 = await flippingCardGame.connect(deployer).createGame(gameId, entryFee)
                await tx1.wait()
            })

            it('Rejects invalid game id', async () => {
                const invalidGameId = 0
                const entryFee = ethers.parseUnits('2', 'ether')
                await expect(flippingCardGame.startGame(invalidGameId, entryFee)).to.be.revertedWith('Game does not exist');
            })

            it('Rejects insufficient entry fee', async () => {
                // Start game with zero value
                const insufficientFee = ethers.parseUnits('0', 'ether')
                await expect(flippingCardGame.connect(player).startGame(gameId, entryFee, {
                    value: insufficientFee
                })).to.be.revertedWith('Entry fee does not match game entry fee');
            })

            it('Rejects new player if game started', async () => {
                // Player starts the game
                await flippingCardGame.connect(player).startGame(gameId, entryFee, {
                    value: entryFee
                })

                // Player 1 starts the game
                await flippingCardGame.connect(player1).startGame(gameId, entryFee, {
                    value: entryFee
                })

                // Attempt to start the game with a new player 
                await expect(flippingCardGame.connect(player2).startGame(gameId, entryFee, {
                    value: entryFee
                })).to.be.revertedWith('Game has already started');
            })
        })
    })

    describe('Stop game', () => {
        describe('Success', () => {
            const gameId = 2
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const createNewGame = await flippingCardGame.connect(deployer).createGame(gameId, entryFee)
                await createNewGame.wait()

                // Start the game with two players
                await flippingCardGame.connect(player).startGame(gameId, entryFee, {
                    value: entryFee
                })
                await flippingCardGame.connect(player1).startGame(gameId, entryFee, {
                    value: entryFee
                })
            })

            it('Should stop the game successfully', async () => {
                // Call the stopGame function
                const stopGame = await flippingCardGame.connect(deployer).stopGame(gameId)
                await stopGame.wait()

                // Check state changes
                expect(await flippingCardGame.gameStarted()).to.be.false
                expect(await flippingCardGame.gameIsStopped(gameId)).to.be.true

                // Verify the event is emitted with the correct arguments
                await expect(stopGame).to.emit(flippingCardGame, 'GameStopped').withArgs(gameId)
            })

            it('Should retain player registration status after stopping the game', async () => {
                // Call the stopGame function
                await flippingCardGame.connect(deployer).stopGame(gameId)

                const isPlayerRegistered = await flippingCardGame.playerInGame(gameId, player.address)
                const isPlayer1Registered = await flippingCardGame.playerInGame(gameId, player1.address)

                expect(isPlayerRegistered).to.be.true
                expect(isPlayer1Registered).to.be.true
            })
        })

        describe('Failure', () => {
            const gameId = 2
            it('Rejects non-owner calling stopGame function', async () => {
                await expect(flippingCardGame.connect(player1).stopGame(gameId)).to.be.reverted;
            })
        })
    })

    describe('Request random words', () => {
        it('Should request random words', async () => {
            tx = await flippingCardGame.connect(deployer).requestRandomWords()
            await tx.wait()
        })
    })
})