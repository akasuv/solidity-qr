const ethers = require("ethers");

const main = async () => {
  const nftContractFactory = await hre.ethers.getContractFactory("QRCode");
  const nftContract = await nftContractFactory.deploy(
  );
  await nftContract.deployed();

  // // Call the function.
  let txn = await nftContract.generateQRCode('123');
  // // Wait for it to be mined.
  const receipt = await txn.wait();

  const data = receipt.logs[0].data;

  const [uri] = ethers.utils.defaultAbiCoder.decode(['string'], data);
  // const [matrix] = ethers.utils.defaultAbiCoder.decode(['uint256[29][29]'], data);
  // const [buf] = ethers.utils.defaultAbiCoder.decode(['uint[70]'], data);

  console.log(uri)
  // console.log(matrix.map(row => row.map(module => module.toNumber())))

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
