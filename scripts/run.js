const ethers = require("ethers");

const main = async () => {
  const nftContractFactory = await hre.ethers.getContractFactory("QRCode");
  const nftContract = await nftContractFactory.deploy(
    { gasPrice: 50000000000000 }
  );
  await nftContract.deployed();

  // // Call the function.
  let txn = await nftContract.generateQRCode('cyberconnect');
  // // Wait for it to be mined.
  const receipt = await txn.wait();

  const data = receipt.logs[0].data;

  const [uri] = ethers.utils.defaultAbiCoder.decode(['string'], data);
  console.log(uri)

};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();
