var GF256_MAP = [],
    GF256_INVMAP = [-1];
for (var i = 0, v = 1; i < 255; ++i) {
    GF256_MAP.push(v);
    GF256_INVMAP[v] = i;
    v = (v * 2) ^ (v >= 128 ? 0x11d : 0);
}

const version =
    [
        [26, 15, 22, 18],
        [1, 1, 2, 2],
        [4, 20],
    ]

const createBaseMatrix = () => {
    const size = 29;
    let matrix = [];
    let reserved = [];

    for (let i = 0; i < size; i++) {
        matrix.push(new Array(29).fill(0));
        reserved.push(new Array(29).fill(0));
    }


    var blit = function (y, x, h, w, bits) {
        for (var i = 0; i < h; ++i) {
            for (var j = 0; j < w; ++j) {
                matrix[y + i][x + j] = (bits[i] >> j) & 1;
                reserved[y + i][x + j] = 1;
            }
        }
    };

    // finder patterns and a part of timing patterns
    // will also mark the format information area (not yet written) as reserved.
    blit(0, 0, 9, 9, [0x7f, 0x41, 0x5d, 0x5d, 0x5d, 0x41, 0x17f, 0x00, 0x40]);
    blit(size - 8, 0, 8, 9, [0x100, 0x7f, 0x41, 0x5d, 0x5d, 0x5d, 0x41, 0x7f, 0x00]);
    blit(
        0,
        size - 8,
        9,
        8,
        [0xfe, 0x82, 0xba, 0xba, 0xba, 0x82, 0xfe, 0x00, 0x00]
    );

    // the rest of timing patterns
    for (var i = 9; i < size - 8; ++i) {
        matrix[6][i] = matrix[i][6] = ~i & 1;
        reserved[6][i] = reserved[i][6] = 1;
    }

    // alignment patterns
    var aligns = version[2],
        m = aligns.length;

    for (var i = 0; i < m; ++i) {
        var minj = i == 0 || i == m - 1 ? 1 : 0,
            maxj = i == 0 ? m - 1 : m;
        for (var j = minj; j < maxj; ++j) {
            blit(aligns[i], aligns[j], 5, 5, [0x1f, 0x11, 0x15, 0x11, 0x1f]);
        }
    }

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (matrix[i][j] == undefined) {
                matrix[i][j] = 0;
            }
        }
    }


    return { matrix, reserved }
}

function generateSVG(matrix) {
    const modsize = 8;
    const size = 296;
    const margin = 4;

    var common =
        ' class= "fg"' + ' width="' + modsize + '" height="' + modsize + '"/>';

    var svg = [
        '<svg viewBox="0 0 296 296" style="shape-rendering:crispEdges" xmlns="http://www.w3.org/2000/svg">',
        "<style>.bg{fill:#FFF}.fg{fill:#000}</style>",
        '<rect class="bg" x="0" y="0" width="296" height="296"></rect>',
    ];

    var yo = margin * modsize;
    for (var y = 0; y < size; ++y) {
        var xo = margin * modsize;
        for (var x = 0; x < size; ++x) {
            if (matrix[y] !== undefined && matrix[y][x])
                svg.push('<rect x="' + xo + '" y="' + yo + '"', common);
            xo += modsize;
        }
        yo += modsize;
    }


    return svg.join('') + '</svg>'
}

function convertToUTF8(data) {
    let utf8 = []
    for (let i = 0; i < data.length; i++) {
        let ch = data.charCodeAt(i)
        utf8.push(ch)
    }

    return utf8;
}


function encode(data) {
    let buf = []
    let bits = 0;
    let remaining = 8;
    let dataLen = data.length
    let maxBufLen = 44;

    function pack(x, n, idx) {
        if (n >= remaining) {
            buf[idx] = bits | (x >> (n -= remaining));
            // while (n >= 8) {
            //     console.log("n", n);
            //     buf.push((x >> (n -= 8)) & 255)
            // };
            bits = 0;
            remaining = 8;
        }
        if (n > 0) { bits |= (x & ((1 << n) - 1)) << (remaining -= n) };
    }

    pack(4, 4, 0);
    pack(dataLen, 8, 0);


    for (var i = 0; i < dataLen; ++i) {
        pack(data[i], 8, i + 1);
    }

    pack(0, 4, dataLen + 1);


    for (let i = data.length + 2; i < maxBufLen - 1; i++) {
        buf[i] = 0xec;
        buf[i + 1] = 0x11;
    }

    // while (buf.length + 1 < maxBufLen) { buf.push(0xec, 0x11) };
    // if (buf.length < maxBufLen) { buf.push(0xec) };

    return buf;
}

function augumentECCs(poly) {
    const nblocks = 1;
    const genpoly = [173, 125, 158, 2, 103, 182, 118, 17, 145, 201, 111, 28, 165, 53, 161, 21, 245, 142, 13, 102, 48, 227, 153, 145, 218, 70]

    var subsizes = [];
    var subsize = (poly.length / nblocks) | 0,
        subsize0 = 0;
    var pivot = nblocks - (poly.length % nblocks);
    for (var i = 0; i < pivot; ++i) {
        subsizes.push(subsize0);
        subsize0 += subsize;
    }
    for (var i = pivot; i < nblocks; ++i) {
        subsizes.push(subsize0);
        subsize0 += subsize + 1;
    }
    subsizes.push(subsize0);

    var eccs = [];
    for (var i = 0; i < nblocks; ++i) {
        eccs.push(
            calculateECC(poly.slice(subsizes[i], subsizes[i + 1]), genpoly)
        );
    }

    var result = [];
    var nitemsperblock = (poly.length / nblocks) | 0;
    for (var i = 0; i < nitemsperblock; ++i) {
        for (var j = 0; j < nblocks; ++j) {
            result.push(poly[subsizes[j] + i]);
        }
    }
    for (var j = pivot; j < nblocks; ++j) {
        result.push(poly[subsizes[j + 1] - 1]);
    }
    for (var i = 0; i < genpoly.length; ++i) {
        for (var j = 0; j < nblocks; ++j) {
            result.push(eccs[j][i]);
        }
    }
    return result;
}

function calculateECC(poly, genpoly) {
    var modulus = poly.slice(0);
    var polylen = poly.length,
        genpolylen = genpoly.length;

    for (var i = 0; i < genpolylen; ++i) modulus.push(0);
    for (var i = 0; i < polylen;) {
        var quotient = GF256_INVMAP[modulus[i++]];
        if (quotient >= 0) {
            for (var j = 0; j < genpolylen; ++j) {
                modulus[i + j] ^= GF256_MAP[(quotient + genpoly[j]) % 255];
            }
        }
    }
    return modulus.slice(polylen);
};

function putData(matrix, reserved, buf) {
    var n = 29;
    var k = 0;
    var dir = -1;

    for (var i = n - 1; i >= 0; i -= 2) {
        if (i == 6) --i; // skip the entire timing pattern column
        var jj = dir < 0 ? n - 1 : 0;
        for (var j = 0; j < n; ++j) {
            for (var ii = i; ii > i - 2; --ii) {
                if (!reserved[jj][ii]) {
                    // may overflow, but (undefined >> x)
                    // is 0 so it will auto-pad to zero.
                    matrix[jj][ii] = (buf[k >> 3] >> (~k & 7)) & 1;
                    ++k;
                }
            }
            jj += dir;
        }
        dir = -dir;
    }
    return matrix;

}


const MASKFUNCS = [
    function (i, j) {
        return (i + j) % 2 == 0;
    },
    function (i, j) {
        return i % 2 == 0;
    },
    function (i, j) {
        return j % 3 == 0;
    },
    function (i, j) {
        return (i + j) % 3 == 0;
    },
    function (i, j) {
        return (((i / 2) | 0) + ((j / 3) | 0)) % 2 == 0;
    },
    function (i, j) {
        return ((i * j) % 2) + ((i * j) % 3) == 0;
    },
    function (i, j) {
        return (((i * j) % 2) + ((i * j) % 3)) % 2 == 0;
    },
    function (i, j) {
        return (((i + j) % 2) + ((i * j) % 3)) % 2 == 0;
    },
];


function maskData(matrix, reserved, mask) {
    function maskf(i, j) {
        return j % 3 == 0;
    }
    var n = matrix.length;
    for (var i = 0; i < n; ++i) {
        for (var j = 0; j < n; ++j) {
            if (!reserved[i][j]) matrix[i][j] ^= maskf(i, j);
        }
    }
    return matrix;
};

function augumentbch(poly, p, genpoly, q) {
    var modulus = poly << q;
    for (var i = p - 1; i >= 0; --i) {
        if ((modulus >> (q + i)) & 1) modulus ^= genpoly << i;
    }
    return (poly << q) | modulus;
};


function putformatinfo(matrix) {
    for (var i = 0; i < 15; ++i) {
        var r = [
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
        ][i];
        var c = [
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
            0,
        ][i];
        matrix[r][8] = matrix[8][c] = (24188 >> i) & 1;
        // we don't have to mark those bits reserved; always done
        // in makebasematrix above.
    }
    return matrix;
};



var QR = function (data) {

    // 1. Create base matrix
    // Use reserved matrix to store reserved modules
    const baseMatrix = createBaseMatrix();


    // 2. Convert data to UTF8
    const utf8Data = convertToUTF8(data);

    // 3. Encode data 
    const buf = encode(utf8Data);

    // 4. Augument ECC
    const bufWithECCs = augumentECCs(buf);

    // return bufWithECCs;


    // 5. Put encoded data into matrix
    const matrixWithData = putData(baseMatrix.matrix, baseMatrix.reserved, bufWithECCs);



    const maskedData = maskData(matrixWithData, baseMatrix.reserved);



    const final = putformatinfo(maskedData, baseMatrix.reserved, 0, 2);


    const svg = generateSVG(final)

    return { uri: 'data:image/svg+xml;base64,' + btoa(svg), matrix: final };

}

module.exports = QR