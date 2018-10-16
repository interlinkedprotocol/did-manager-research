import { encodeMethod } from 'ethjs-abi'
import { toWei } from 'ethjs-unit'
import { sign } from 'ethjs-signer'
import { find } from 'lodash'
import { BN } from 'ethereumjs-util'

import { ethInstance } from '../connect'
import { waitBlock } from './waitBlock'

const TX_NO_BYTECODE = '0x'
const TX_GAS_PRICE = toWei(100, 'gwei')
const TX_GAS_LIMIT = 100000

const getBytecode = (contractABI, methodName, params) => encodeMethod(find(contractABI, { name: methodName }), params)

export async function getRawTx (data) {
  if (!data.from) throw new Error('Missing required parameters', data)

  const nonce = await ethInstance.getTransactionCount(data.from, 'pending')
  const rawTx = {
    from: data.from,
    to: data.to,
    data: TX_NO_BYTECODE,
    nonce,
    value: data.value,
    gasPrice: data.gasPrice || TX_GAS_PRICE,
    gasLimit: data.gasLimit || TX_GAS_LIMIT
  }

  if(data.contractABI && data.methodName && data.params) rawTx.data = getBytecode(data.contractABI, data.methodName, data.params)

  return rawTx
}

export async function calcExtraFundsRequired (senderAddress, amountWei) {
  const senderBalance = await ethInstance.getBalance(senderAddress, 'latest')
  return senderBalance.ucmp(amountWei) === -1 ? amountWei.sub(senderBalance) : new BN(0)
}

export const signTx = (privateKey, rawTx) => sign(rawTx, privateKey)

export async function sendTx (tx) {
  const txHash = await ethInstance.sendTransaction(tx)
  const txStatus = waitBlock(txHash)
  return { txHash, txStatus }
}

export async function sendRawTx (sigHex) {
  const txHash = await ethInstance.sendRawTransaction(sigHex)
  const txStatus = waitBlock(txHash)
  return { txHash, txStatus }
}
