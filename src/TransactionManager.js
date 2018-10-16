import { encodeMethod } from 'ethjs-abi'
import { find } from 'lodash'
import { BN } from 'ethereumjs-util'
import { sign } from 'ethjs-signer'


// export async function changeOwnerTx(owner, newOwner, commonTxData) {
//   const txData = {
//     ...commonTxData,
//     from: this.address,
//     methodName: 'changeOwner',
//     params: [this.address, newOwner]
//   }
//
//   return await getRawTx(txData)
// }
//
// export async function lookupOwner(cache = true) {
//   if (cache && this.owner) return this.owner
//   const result = await didRegistryInstance.identityOwner(this.address)
//   return result['0']
// }
//



export default class TransactionManager {
  static getBytecode = (contractABI, methodName, params) => encodeMethod(find(contractABI, { name: methodName }), params)

  static getUpfrontCost = rawTx => {
    if (!rawTx.gasLimit || !rawTx.gasPrice) throw new Error('Missing required parameter')

    return new BN(rawTx.gasLimit)
      .imul(new BN(rawTx.gasPrice))
      .iadd(new BN(rawTx.value))
  }

  static signTx = (privateKey, rawTx) => sign(rawTx, privateKey)

  constructor(ethInstance, registry, contractAbi) {
    this.registry = registry
    this.contractABI = contractAbi
    this.ethInstance = ethInstance
  }

  async changeOwnerTx(owner, newOwner) {
    const txData = {
      to: this.registry,
      contractABI: this.contractABI,
      from: owner,
      methodName: 'changeOwner',
      params: [owner, newOwner]
    }

    return await this.getRawTx(txData)
  }

  async getRawTx(txData) {
    if (!txData.from) throw new Error('Missing required parameters', txData)

    const nonce = await this.ethInstance.getTransactionCount(txData.from, 'pending')
    const rawTx = {
      from: txData.from,
      to: txData.to,
      data: txData.data || TX_NO_BYTECODE,
      nonce,
      value: txData.value,
      gasPrice: txData.gasPrice || TX_GAS_PRICE,
      gasLimit: txData.gasLimit || TX_GAS_LIMIT
    }

    if(txData.contractABI && txData.methodName && txData.params)
      rawTx.data = TransactionManager.getBytecode(txData.contractABI, txData.methodName, txData.params)

    return rawTx
  }

  async sendFundedTx(rawTx, methodName = '') {
    const sendTxFunctions = []

    const extra = await calcExtraFundsRequired(rawTx.from, getUpfrontCost(rawTx))
    if (extra) {
      const donatorBalance = await ethInstance.getBalance(DONATOR_ADDRESS, 'latest')

      if (donatorBalance.ucmp(extra) !== -1) {
        const tx = await getRawTx({
          from: DONATOR_ADDRESS,
          to: rawTx.from,
          value: extra
        })
        // const sigHex = await this.withPrivateKeyOfDonator(signTx)(tx)
        sendTxFunctions.push({ name: `Providing extra funds required for execution of ${methodName}`, func: () => sendTx(tx) })
      } else {
        throw new Error(
          `Requested extra funds ${fromWei(extra, 'ether')} Eth is above Donator's balance ${fromWei(donatorBalance, 'ether')} Eth`
        )
      }
    }
    sendTxFunctions.push({ name: methodName || 'Main function', func: () => this.sendSignedTx(rawTx) })
    return sendTxFunctions
  }
}