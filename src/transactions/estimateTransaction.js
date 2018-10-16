import { BN } from 'ethereumjs-util'

const fees = require('ethereum-common/params.json')

function toCreationAddress (to) {
  return to.toString('hex') === ''
}

export function getDataFee (bytecode) {
  const cost = new BN(0)
  for (let i = 0; i < bytecode.length; i++) {
    bytecode[i] === 0 ? cost.iaddn(fees.txDataZeroGas.v) : cost.iaddn(fees.txDataNonZeroGas.v)
  }
  return cost
}

export function getBaseFee (rawTx, homestead = true) { 
  if (!rawTx.data || !rawTx.to) throw new Error('Missing required parameter')

  const fee = getDataFee(rawTx.data).iaddn(fees.txGas.v)
  if (homestead && toCreationAddress(rawTx.to)) {
    fee.iaddn(fees.txCreation.v)
  }
  return fee
}

export function getUpfrontCost (rawTx) {
  if (!rawTx.gasLimit || !rawTx.gasPrice) throw new Error('Missing required parameter')

  return new BN(rawTx.gasLimit)
    .imul(new BN(rawTx.gasPrice))
    .iadd(new BN(rawTx.value))
}
