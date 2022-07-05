require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config({ path: ".env" });

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.1",
  defaultNetwork: "hardhat",
  mocha: {
    timeout: 100000000
  },
  gasReporter: {
    currency: 'USD',
    coinmarketcap: '4f5cfefe-6157-436c-8293-b0cd708e7193'
  },
  networks: {
    rinkeby: {
      url: process.env.ALCHEMY_API_KEY_URL,
      accounts: [process.env.RINKEBY_PRIVATE_KEY],
    },
    hardhat: {
      blockGasLimit: 10000000000000,// whatever you want here
      allowUnlimitedContractSize: true,
    },
  },
};
