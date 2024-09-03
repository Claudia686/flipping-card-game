require("dotenv").config()
require("@nomicfoundation/hardhat-toolbox")
const privateKey = process.env.PRIVATE_KEY || ""

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber:6534921
      }
    },

    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
       accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }

  }
};

