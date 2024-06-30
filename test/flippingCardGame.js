const {
	expect
} = require('chai');
const {
	ethers
} = require('hardhat');

const subscriptionIdBigInt = BigInt('27890476837314099658103021851379748238874653461952564640529128605938975681252')
const uint64Max = BigInt('1844674407370955161')
const subscriptionId = subscriptionIdBigInt % (uint64Max + BigInt(1))

const _linkToken = '0x779877a7b0d9e8603169ddbd7836e478b4624789';
const _keyHash = '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae';
const _vrfCoordinator = '0x9ddfaca8183c41ad55329bdeed9f6a8d53168b1b';

describe('FlippingCardGame', () => {
	let flippingCardGame, deployer, player

	beforeEach(async () => {
		[deployer, player] = await ethers.getSigners()
		const FlippingCardGame = await ethers.getContractFactory('FlippingCardGame')
		flippingCardGame = await FlippingCardGame.deploy(subscriptionId, _linkToken, _keyHash, _vrfCoordinator)
	})

	describe('Deployment', () => {
		it('Should have correct subscriptionId', async () => {
			expect((await flippingCardGame.s_subscriptionId()).toString()).to.equal(subscriptionId.toString());
		})

		it('Should have correct keyHash', async () => {
			expect(await flippingCardGame.keyHash()).to.equal(_keyHash)
		})

		it('Should have correct linkToken', async () => {
			expect((await flippingCardGame.linkToken()).toLowerCase()).to.equal(_linkToken.toLowerCase());
		})

		it('Should have correct VRFCoordinator address', async function() {
			const coordinatorAddress = await flippingCardGame.getVRFCoordinator();
			expect(coordinatorAddress.toLowerCase()).to.equal(_vrfCoordinator.toLowerCase());
		})

		it('Check for deployer address', async () => {
			expect(await flippingCardGame.owner()).to.equal(deployer.address)
		})
	})

	describe('Create game', () => {
		describe('Success', () => {
			let gameId, newEntryFee

			beforeEach(async () => {
				gameId = 1;
				newEntryFee = ethers.parseUnits('2', 'ether')
			})

			// Create a game
			it('Should allow owner to set a game', async () => {
				const tx = await flippingCardGame.connect(deployer).createGame(gameId, newEntryFee)
				await tx.wait()

				// Check if new entry fee is set correctly
				const storedFee = await flippingCardGame.gameEntryFee(gameId);
				expect(storedFee).to.equal(newEntryFee)

				// Check if gameId is set correctly
				const storedGameId = await flippingCardGame.gameId();
				expect(storedGameId).to.equal(gameId)
			})
            
            // Check initial state of the game started
			it('Should set game started to false', async () => {
				expect(await flippingCardGame.gameStarted()).to.be.false
			})  
            
            // Emit game created event   
			it('Should emit game created event with correct arguments', async () => {
				const tx = await flippingCardGame.connect(deployer).createGame(gameId, newEntryFee)
				await expect(tx).to.emit(flippingCardGame, 'GameCreated').withArgs(gameId, newEntryFee)
			})
		})
	})
})