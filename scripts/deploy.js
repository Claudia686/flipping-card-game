const hre = require('hardhat');

async function main() {
	const subscriptionId = 1
	const _linkToken = '0x779877a7b0d9e8603169ddbd7836e478b4624789'
	const _keyHash = '0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae'
	const _vrfCoordinator = '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823'

	// VRFCoordinatorV2Mock
	const baseFee = ethers.parseUnits('0.1', 'ether')
	const gasPriceLink = ethers.parseUnits('1', 'gwei')

	 const [deployer, player, player1, player2] = await ethers.getSigners()
     
	// Deploy VRFCoordinatorV2Mock
	const VRFCoordinatorV2Mock = await ethers.getContractFactory('VRFCoordinatorV2Mock')
	vrfCoordinatorMock = await VRFCoordinatorV2Mock.deploy(baseFee, gasPriceLink)
	await vrfCoordinatorMock.waitForDeployment()
	console.log(`vrfCoordinatorMock deployed to: ${await vrfCoordinatorMock.getAddress()}`)

	// Deploy FlippingCardGame
	const FlippingCardGame = await ethers.getContractFactory('FlippingCardGame')
	flippingCardGame = await FlippingCardGame.deploy(subscriptionId, _linkToken, _keyHash, vrfCoordinatorMock)
	await flippingCardGame.waitForDeployment()
	console.log(`flippingCardGame deployed to: ${await flippingCardGame.getAddress()}`)
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
})