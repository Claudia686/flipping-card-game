const { expect } = require('chai');
const { ethers } = require('hardhat');

const subscriptionIdBigInt = BigInt("27890476837314099658103021851379748238874653461952564640529128605938975681252")
const uint64Max = BigInt("18446744073709551615")
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
			expect((await flippingCardGame.linkToken()).toLowerCase()).to.equal(_linkToken.toLowerCase())
			})

			it("Should have correct VRFCoordinator address", async function () {
            const coordinatorAddress = await flippingCardGame.getVRFCoordinator();
            expect(coordinatorAddress.toLowerCase()).to.equal(_vrfCoordinator.toLowerCase());
			})

		it('Check for deployer address', async () => {
			expect(await flippingCardGame.owner()).to.equal(deployer.address)
		})
	})
})