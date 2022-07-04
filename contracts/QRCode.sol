// SPDX-License-Identifier: GPL-3.0
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

pragma solidity >=0.7.0 <0.9.0;

contract QRCode is ERC721URIStorage {
    uint256[][] matrix;
    uint256[][] reserved;
    uint256 bits = 0;
    uint256 remaining = 8;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("QR Code", "QR") {}

    // event MatrixCreated(uint256[][] matrix);
    // event Encoded(uint256[][] encoded);
    // event SVG(string[] svg);
    event QRCodeURIGenerated(string str);

    function generateQRCode(string memory handle) public {
        // 1. Create base matrix
        createBaseMatrix();
        // 2. Encode Data
        uint8[] memory encoded = encode(
            string(abi.encodePacked("https://link3.to/", handle))
        );
        // 3. Generate buff
        uint256[44] memory buf = generateBuf(encoded);
        // 4. Augument ECCs
        uint256[70] memory bufWithECCs = augumentECCs(buf);

        // 5. put data into matrix
        putData(bufWithECCs);

        // 6. mask data
        maskData();

        // 7. Put format info
        putFormatInfo();

        // 8. Compose SVG and convert to base64
        string memory QRCodeURI = generateQRURI();

        // uint256 newItemId = _tokenIds.current();

        // Actually mint the NFT to the sender using msg.sender.
        // _safeMint(msg.sender, newItemId);

        // Set the NFTs data.
        // _setTokenURI(newItemId, QRCodeURI);

        // Increment the counter for when the next NFT is minted.
        // _tokenIds.increment();

        emit QRCodeURIGenerated(QRCodeURI);
    }

    function maskData() internal {
        for (uint256 i = 0; i < 29; ++i) {
            for (uint256 j = 0; j < 29; ++j) {
                if (reserved[i][j] == 0) {
                    if (j % 3 == 0) {
                        matrix[i][j] ^= 1;
                    } else {
                        matrix[i][j] ^= 0;
                    }
                }
            }
        }
    }

    function generateBuf(uint8[] memory data)
        public
        returns (uint256[44] memory)
    {
        uint256[44] memory buf;
        uint256 dataLen = data.length;
        uint8 maxBufLen = 44;

        buf = pack(buf, 4, 4, 0);
        buf = pack(buf, dataLen, 8, 0);

        for (uint8 i = 0; i < dataLen; ++i) {
            buf = pack(buf, data[i], 8, i + 1);
        }

        buf = pack(buf, 0, 4, dataLen + 1);

        for (uint256 i = data.length + 2; i < maxBufLen - 1; i++) {
            buf[i] = 0xec;
            buf[i + 1] = 0x11;
        }

        // while (buf.length + 1 < maxBufLen) {
        //     buf.push(0xec);
        //     buf.push(0x11);
        // }

        return buf;
    }

    function augumentECCs(uint256[44] memory poly)
        internal
        view
        returns (uint256[70] memory)
    {
        uint8 nblocks = 1;
        uint8[26] memory genpoly = [
            173,
            125,
            158,
            2,
            103,
            182,
            118,
            17,
            145,
            201,
            111,
            28,
            165,
            53,
            161,
            21,
            245,
            142,
            13,
            102,
            48,
            227,
            153,
            145,
            218,
            70
        ];

        uint8[2] memory subsizes = [0, 44];
        uint256 nitemsperblock = 44;
        uint256[26][1] memory eccs;
        uint256[70] memory result;
        uint256[44] memory partPoly;

        for (uint256 i; i < 44; i++) {
            partPoly[i] = poly[i];
        }

        eccs[0] = calculateECC(partPoly, genpoly);

        for (uint8 i = 0; i < nitemsperblock; ++i) {
            for (uint8 j = 0; j < nblocks; ++j) {
                result[i] = poly[subsizes[j] + i];
            }
        }
        for (uint8 i = 0; i < genpoly.length; ++i) {
            for (uint8 j = 0; j < nblocks; ++j) {
                result[i + 44] = eccs[j][i];
            }
        }

        return result;
    }

    function calculateECC(uint256[44] memory poly, uint8[26] memory genpoly)
        internal
        view
        returns (uint256[26] memory)
    {
        uint256[256] memory GF256_MAP;
        uint256[256] memory GF256_INVMAP;
        uint256[70] memory modulus;
        uint8 polylen = uint8(poly.length);
        uint8 genpolylen = uint8(genpoly.length);
        uint256[26] memory result;
        uint256 gf256_value = 1;

        GF256_INVMAP[0] = 0;

        for (uint256 i = 0; i < 255; ++i) {
            GF256_MAP[i] = gf256_value;
            GF256_INVMAP[gf256_value] = i;
            gf256_value = (gf256_value * 2) ^ (gf256_value >= 128 ? 0x11d : 0);
        }

        for (uint8 i = 0; i < 44; i++) {
            modulus[i] = poly[i];
        }

        for (uint8 i = 44; i < 70; ++i) {
            modulus[i] = 0;
        }

        for (uint8 i = 0; i < polylen; ) {
            uint256 idx = modulus[i++];
            if (idx > 0) {
                uint256 quotient = GF256_INVMAP[idx];
                for (uint8 j = 0; j < genpolylen; ++j) {
                    modulus[i + j] ^= GF256_MAP[(quotient + genpoly[j]) % 255];
                }
            }
        }

        for (uint8 i = 0; i < modulus.length - polylen; i++) {
            result[i] = modulus[polylen + i];
        }

        return result;
    }

    function pack(
        uint256[44] memory buf,
        uint256 x,
        uint256 n,
        uint256 index
    ) public returns (uint256[44] memory) {
        uint256[44] memory newBuf = buf;

        if (n >= remaining) {
            newBuf[index] = bits | (x >> (n -= remaining));
            bits = 0;
            remaining = 8;
        }
        if (n > 0) {
            bits |= (x & ((1 << n) - 1)) << (remaining -= n);
        }

        return newBuf;
    }

    function encode(string memory str) public pure returns (uint8[] memory) {
        bytes memory byteString = bytes(str);
        uint8[] memory encodedArr = new uint8[](byteString.length);

        for (uint8 i = 0; i < encodedArr.length; i++) {
            encodedArr[i] = uint8(byteString[i]);
        }

        return encodedArr;
    }

    function bytesToUint(bytes memory b) public pure returns (uint256) {
        uint256 number;
        for (uint256 i = 0; i < b.length; i++) {
            number =
                number +
                uint256(uint8(b[i])) *
                (2**(8 * (b.length - (i + 1))));
        }
        return number;
    }

    function createBaseMatrix() public {
        uint256 size = 29;
        uint256[29] memory row;
        uint8[2] memory aligns = [4, 20];

        for (uint256 i = 0; i < size; i++) {
            row[i] = 0;
        }

        for (uint256 j = 0; j < size; j++) {
            matrix.push(row);
            reserved.push(row);
        }

        blit(
            0,
            0,
            9,
            9,
            [0x7f, 0x41, 0x5d, 0x5d, 0x5d, 0x41, 0x17f, 0x00, 0x40]
        );
        blit(
            size - 8,
            0,
            8,
            9,
            [0x100, 0x7f, 0x41, 0x5d, 0x5d, 0x5d, 0x41, 0x7f, 0x00]
        );
        blit(
            0,
            size - 8,
            9,
            8,
            [
                uint16(0xfe),
                uint16(0x82),
                uint16(0xba),
                uint16(0xba),
                uint16(0xba),
                uint16(0x82),
                uint16(0xfe),
                uint16(0x00),
                uint16(0x00)
            ]
        );

        for (uint256 i = 9; i < size - 8; ++i) {
            matrix[6][i] = matrix[i][6] = ~i & 1;
            reserved[6][i] = reserved[i][6] = 1;
        }

        // alignment patterns
        for (uint8 i = 0; i < 2; ++i) {
            uint8 minj = i == 0 || i == 1 ? 1 : 0;
            uint8 maxj = i == 0 ? 1 : 2;
            for (uint8 j = minj; j < maxj; ++j) {
                blit(
                    aligns[i],
                    aligns[j],
                    5,
                    5,
                    [
                        uint16(0x1f),
                        uint16(0x11),
                        uint16(0x15),
                        uint16(0x11),
                        uint16(0x1f),
                        uint16(0x00),
                        uint16(0x00),
                        uint16(0x00),
                        uint16(0x00)
                    ]
                );
            }
        }
    }

    function blit(
        uint256 y,
        uint256 x,
        uint256 h,
        uint256 w,
        uint16[9] memory data
    ) internal {
        for (uint256 i = 0; i < h; ++i) {
            for (uint256 j = 0; j < w; ++j) {
                matrix[y + i][x + j] = (data[i] >> j) & 1;
                reserved[y + i][x + j] = 1;
            }
        }
    }

    function putFormatInfo() internal {
        uint8[15] memory infoA = [
            0,
            1,
            2,
            3,
            4,
            5,
            7,
            8,
            22,
            23,
            24,
            25,
            26,
            27,
            28
        ];

        uint8[15] memory infoB = [
            28,
            27,
            26,
            25,
            24,
            23,
            22,
            21,
            7,
            5,
            4,
            3,
            2,
            1,
            0
        ];

        for (uint8 i = 0; i < 15; ++i) {
            uint8 r = infoA[i];
            uint8 c = infoB[i];
            matrix[r][8] = matrix[8][c] = (24188 >> i) & 1;
            // we don't have to mark those bits reserved; always done
            // in makebasematrix above.
        }
    }

    function putData(uint256[70] memory data) internal {
        int256 n = 29;
        uint256 k = 0;
        int8 dir = -1;

        for (int256 i = n - 1; i >= 0; i = i - 2) {
            if (i == 6) {
                --i;
            } // skip the entire timing pattern column
            int256 jj = dir < 0 ? n - 1 : int256(0);
            for (int256 j = 0; j < n; j++) {
                for (int256 ii = int256(i); ii > int256(i) - 2; ii--) {
                    if (
                        reserved[uint256(jj)][uint256(ii)] == 0 && k >> 3 < 70
                    ) {
                        matrix[uint256(jj)][uint256(ii)] =
                            (data[k >> 3] >> (~k & 7)) &
                            1;
                        ++k;
                    }
                }

                if (dir == -1) {
                    jj = jj - 1;
                } else {
                    jj = jj + 1;
                }
            }

            dir = -dir;
        }
    }

    function retrieveMatrix() public view returns (uint256[] memory) {
        return matrix[0];
    }

    function retrieveReserrved() public view returns (uint256[][] memory) {
        return reserved;
    }

    function generateQRURI() public returns (string memory) {
        uint256 modsize = 8;
        uint256 size = 29;
        uint256 margin = 4;
        string memory QRCodeURI;

        string memory common = string(
            abi.encodePacked(
                ' class= "fg"',
                ' width="',
                Strings.toString(modsize),
                '" height="',
                Strings.toString(modsize),
                '"/>'
            )
        );

        QRCodeURI = "";
        uint256 yo = margin * modsize;
        for (uint256 y = 0; y < size; ++y) {
            uint256 xo = margin * modsize;
            for (uint256 x = 0; x < size; ++x) {
                if (matrix[y][x] == 1) {
                    QRCodeURI = string(
                        abi.encodePacked(
                            QRCodeURI,
                            '<rect x="',
                            Strings.toString(xo),
                            '" y="',
                            Strings.toString(yo),
                            '"',
                            common
                        )
                    );
                }
                xo += modsize;
            }
            yo += modsize;
        }

        QRCodeURI = string(
            abi.encodePacked(
                '<svg viewBox="0 0 296 296" style="shape-rendering:crispEdges" xmlns="http://www.w3.org/2000/svg"><style>.bg{fill:#FFF}.fg{fill:#000}</style><rect class="bg" x="0" y="0" width="296" height="296"></rect>',
                QRCodeURI,
                "</svg>"
            )
        );

        QRCodeURI = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                Base64.encode(abi.encodePacked(QRCodeURI))
            )
        );

        return QRCodeURI;
    }
}
