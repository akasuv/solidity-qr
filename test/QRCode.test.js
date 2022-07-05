const { expect, assert } = require("chai");
const { ethers } = require("ethers");
const QR = require("../scripts/qr");

describe("QRCode", () => {
    let nftContractFactory
    let nftContract

    beforeEach(
        async () => {
            nftContractFactory = await hre.ethers.getContractFactory("QRCode");
            nftContract = await nftContractFactory.deploy();
            await nftContract.deployed();
        }
    )


    it("Should generatea qr code", async () => {

        let txn = await nftContract.generateQRCode('123');
        const receipt = await txn.wait();
        // const data = receipt.logs[0].data;

        // const [uri] = ethers.utils.defaultAbiCoder.decode(['string'], data);
        // const [matrix] = ethers.utils.defaultAbiCoder.decode(['uint256[29][29]'], data);
        // const [buf] = ethers.utils.defaultAbiCoder.decode(['uint[70]'], data);


        // const jsMatrix = QQQ('123');
        // const solMatrix = matrix.map(row => row.map(module => module.toNumber()))

        // console.log(solMatrix)

        // const jsBuf = QQQ('123')
        // const solBuf = buf.map(module => module.toNumber())
        // assert.deepEqual(jsBuf, solBuf)

        // console.log(jsBuf.every((module, i) => module === solBuf[i]))

        // assert.deepEqual(jsMatrix, solMatrix)
        // console.log('-----------jsURI------------')
        // console.log(jsURI)
        // console.log('-----------jsURI------------')
        // console.log('-----------solURI------------')
        // console.log(uri)
        // console.log('-----------solURI------------')
        // assert.equal(jsURI, uri);

        // let isAllEqual = [];

        // for (let i = 0; i < jsMatrix.length; i++) {
        //     for (let j = 0; j < jsMatrix[i].length; j++) {
        //         isAllEqual.push(solMatrix[i][j] === jsMatrix[i][j]);
        //         console.log(solMatrix[i][j], jsMatrix[i][j])
        //     }
        // }


    })

})

