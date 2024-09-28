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

    describe('Create a game', () => {
        describe('Success', () => {
            const newEntryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const tx = await flippingCardGame.connect(deployer).createGame(newEntryFee)
                await tx.wait()
            })

            it('Should allow owner to set a game', async () => {
                // Check if new entry fee is set correctly
                const storedFee = await flippingCardGame.gameEntryFee(0);
                expect(storedFee).to.equal(newEntryFee);
            })

            it('Should set game started to false', async () => {
                // Check initial state of the game started
                expect(await flippingCardGame.gameStarted()).to.be.false
            })

            it('Should emit game created event with correct arguments', async () => {
                // Emit game created event 
                const tx = await flippingCardGame.connect(deployer).createGame(newEntryFee)
                await expect(tx).to.emit(flippingCardGame, 'GameCreated').withArgs(newEntryFee)
            })
        })

        describe('Failure', () => {
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                await flippingCardGame.connect(deployer).createGame(entryFee);
            })

            it('Rejects when creating a game with zero entry fee', async () => {
                // Revert zero entry fee
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

    describe('Join the game', () => {
        describe('Success', () => {
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const tx = await flippingCardGame.connect(deployer).createGame(entryFee)
                await tx.wait()

                // Retrieve gameId
                gameId = await flippingCardGame.gameId()

                // Players join the game
                await flippingCardGame.connect(player).joinGame()
                await flippingCardGame.connect(player1).joinGame()
            })

            it('Should register players for the game', async () => {
                // Check if players are registered in the game
                const registeredPlayer = await flippingCardGame.playerInGame(gameId, player.address)
                expect(registeredPlayer).to.be.true
                const registeredPlayer1 = await flippingCardGame.playerInGame(gameId, player1.address)
                expect(registeredPlayer1).to.be.true
            })
        })

        describe('Failure', () => {
            it('Rejects registered player', async () => {
                // Reject player if already registered
                await flippingCardGame.connect(player).joinGame()
                await expect(flippingCardGame.connect(player).joinGame())
                    .to.be.revertedWith('Player is already registered in the game');
            })
        })
    })

    describe('Start the game', () => {
        describe('Success', () => {
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const tx = await flippingCardGame.connect(deployer).createGame(entryFee)
                await tx.wait()
            })

            it('Check for correct entry fee', async () => {
                // Check for correct entry fee
                const expectedEntryFee = await ethers.parseUnits('2', 'ether')
                const storedEntryFee = await flippingCardGame.gameEntryFee(gameId)
                expect(expectedEntryFee).to.equal(storedEntryFee)
            })

            it('Check for game status', async () => {
                // Game should not started yet
                let gameStarted = await flippingCardGame.gameStarted()
                expect(gameStarted).to.be.false
            })

            it('Should increment gameId', async () => {
                // Check if gameId increment to 1
                const entryFee = ethers.parseUnits('2', 'ether')

                // Check for game id before join the game
                const gameIdBefore = await flippingCardGame.gameId()
                expect(gameIdBefore).to.equal(0)

                // Players join the game
                await flippingCardGame.connect(player).joinGame()
                await flippingCardGame.connect(player1).joinGame()

                // Check if first player is registered
                const isPlayerRegistered = await flippingCardGame.playerInGame(gameId, player.address)
                expect(isPlayerRegistered).to.equal(true);

                // Check if second player is registered
                const isPlayer1Registered = await flippingCardGame.playerInGame(gameId, player1.address)
                expect(isPlayer1Registered).to.equal(true);

                // StartGame game
                const tx = await flippingCardGame.startGame({
                    value: entryFee
                })
                await tx.wait()

                // Check the state of the game after it has started
                const gameStarted = await flippingCardGame.gameStarted()
                expect(gameStarted).to.be.true;

                // Check the game id to be incremented by 1
                const gameIdAfter = await flippingCardGame.gameId()
                expect(await gameIdAfter).to.equal(1);
            })
        })

        describe('Failure', () => {
            const entryFee = ethers.parseUnits('2', 'ether')
            const insufficientFee = ethers.parseUnits('0', 'ether')

            beforeEach(async () => {
                // Create new game
                await flippingCardGame.connect(deployer).createGame(entryFee)

                // Players join the game
                await flippingCardGame.connect(player).joinGame()
                await flippingCardGame.connect(player1).joinGame()
            })

            it('Rejects insufficient entry fee', async () => {
                // Start the game with zero value
                await expect(flippingCardGame.startGame({
                    value: insufficientFee
                })).to.be.revertedWith('Entry fee does not match game entry fee');
            })

            it('Rejects new player if game started', async () => {
                // Start the game
                await flippingCardGame.startGame({
                    value: entryFee
                })

                // Attempt to start the game with a new player 
                await expect(flippingCardGame.connect(player2).joinGame())
                    .to.be.revertedWith('Game has already started');
            })
        })
    })

    describe('Get game players', () => {
        const entryFee = ethers.parseUnits('2', 'ether')

        it('Should update gamePlayers array', async () => {
            // Create a game
            await flippingCardGame.connect(deployer).createGame(entryFee)

            // Players join the game
            await flippingCardGame.connect(player).joinGame()
            await flippingCardGame.connect(player1).joinGame()
            const currentGameId = await flippingCardGame.gameId()

            // Start the game
            await flippingCardGame.startGame({
                value: entryFee
            })

            // Get players in the game
            const players = await flippingCardGame.getGamePlayers(currentGameId)
            expect(players).to.include(player.address);
            expect(players).to.include(player1.address);
        })
    })

    describe('Request random words', () => {
        describe('Success', () => {
            it('Should allow the owner to request random words', async () => {
                // Request random words
                await flippingCardGame.connect(deployer).requestRandomWords()
                const result = await flippingCardGame.requestInProgress()
                expect(result).to.equal(true);
            })

            it('Should emit RandomWordsRequested event', async () => {
                // Emit RandomWordsRequested event
                const tx = await flippingCardGame.connect(deployer).requestRandomWords()
                await expect(tx).to.emit(flippingCardGame, 'RandomWordsRequested')
            })
        })

        describe('Failure', () => {
            it('Rejects new requests during an active request', async () => {
                // Revert new request if current request is in progress
                await flippingCardGame.connect(deployer).requestRandomWords()
                await expect(flippingCardGame.connect(deployer).requestRandomWords())
                .to.be.revertedWith('Previous request still in progress');
            })
        })
    })

    describe('Stop the game', () => {
        describe('Success', () => {
            const entryFee = ethers.parseUnits('2', 'ether')

            beforeEach(async () => {
                // Create a game
                const createNewGame = await flippingCardGame.connect(deployer).createGame(entryFee)
                await createNewGame.wait()

                // Players join the game
                await flippingCardGame.connect(player).joinGame()
                await flippingCardGame.connect(player1).joinGame()
                gameId = await flippingCardGame.gameId()

                // Start the game
                await flippingCardGame.startGame({
                    value: entryFee
                })
            })

            it('Should stop the game successfully', async () => {
                // Call stopGame function
                const stopGame = await flippingCardGame.connect(deployer).stopGame()
                await stopGame.wait()

                // Check state changes
                expect(await flippingCardGame.gameStarted()).to.be.false
            })

            it('Retain player registration status after stopping the game', async () => {
                // Retrieve gameId
                gameId = await flippingCardGame.gameId()
                // StopGame the game
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
})