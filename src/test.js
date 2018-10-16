const x = require('buffer')
const y = require('ethereumjs-util')

function bytes32toString() {
  const bytes32 = '0x5f16f4c7f149abe752e3d44668a7bd949eb0a533583216b04000000000000000'
  console.log(y.toBuffer(bytes32));
  console.log(x.Buffer.from(bytes32.slice(2), 'hex'));
}

bytes32toString()