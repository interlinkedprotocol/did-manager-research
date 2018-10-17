import { BN } from 'ethereumjs-util'
import { find } from 'lodash'
import { sign } from 'ethjs-signer'
import { fromWei, toWei } from 'ethjs-unit'
import { encodeMethod } from 'ethjs-abi'

import { stringToBytes32, attributeToHex } from './utils/formatting'

export default class TransactionManager {
  static getBytecode = (contractABI, methodName, params) => encodeMethod(find(contractABI, { name: methodName }), params)

  static getUpfrontCost = rawTx => {
    if (!rawTx.gasLimit || !rawTx.gasPrice) throw new Error('Missing required parameter')

    return new BN(rawTx.gasLimit)
      .imul(new BN(rawTx.gasPrice))
      .iadd(new BN(rawTx.value))
  }

  static signTx = (privateKey, rawTx) => sign(rawTx, privateKey)

  constructor(ethInstance, registry, contractAbi, donatorAddress) {
    this.registry = registry
    this.contractABI = contractAbi
    this.ethInstance = ethInstance
    this.donatorAddress = donatorAddress

    this.txConstants = {
      TX_NO_BYTECODE: '0x',
      TX_GAS_PRICE: toWei(100, 'gwei'),
      TX_GAS_LIMIT: 100000
    }
  }

  async calcExtraFundsRequired(senderAddress, amountWei) {
    const senderBalance = await this.ethInstance.getBalance(senderAddress, 'latest')
    return senderBalance.ucmp(amountWei) === -1 ? amountWei.sub(senderBalance) : new BN(0)
  }
  
  async getRawTx(txData) {
    if (!txData.from) throw new Error('Missing required parameters', txData)

    const nonce = await this.ethInstance.getTransactionCount(txData.from, 'pending')
    const rawTx = {
      from: txData.from,
      to: txData.to,
      data: txData.data || this.txConstants.TX_NO_BYTECODE,
      nonce,
      value: txData.value,
      gasPrice: txData.gasPrice || this.txConstants.TX_GAS_PRICE,
      gasLimit: txData.gasLimit || this.txConstants.TX_GAS_LIMIT
    }

    if(txData.contractABI && txData.methodName && txData.params)
      rawTx.data = TransactionManager.getBytecode(txData.contractABI, txData.methodName, txData.params)

    return rawTx
  }

  async waitBlock(txHash) {
    let times = 0
    const interval = 4000
    const timeout = 60000

    while (true || (times * interval <= timeout) ) {
      try {
        const receipt = await this.ethInstance.getTransactionReceipt(txHash)
        return receipt.status === '0x1'
      } catch (e) {
        if (times * (interval + 1) > timeout) throw new Error(`Waiting block for more then ${timeout} ms`)
        console.log(`Mining...`/* ${etherscanBaseUrl}/${txHash} */)
        await (new Promise(resolve => setTimeout(resolve, interval)))
      }
      times++
    }
  }

  async sendFunds(rawTx) {
    const extra = await this.calcExtraFundsRequired(rawTx.from, TransactionManager.getUpfrontCost(rawTx))

    if(extra) {
      const donatorBalance = await this.ethInstance.getBalance(this.donatorAddress, 'latest')

      if(donatorBalance.ucmp(extra) !== -1) {
        const tx = await this.getRawTx({
          from: this.donatorAddress,
          to: rawTx.from,
          value: extra
        })

        const txHash = await this.ethInstance.sendTransaction(tx)
        return await this.waitBlock(txHash)
      } else {
        throw new Error(`Requested extra funds ${fromWei(extra, 'ether')}
           Eth is above Donator's balance ${fromWei(donatorBalance, 'ether')} Eth`)
      }
    }
  }
  
  async changeOwnerTx(identity, newOwner, { from }) {
    const txData = {
      from,
      to: this.registry,
      contractABI: this.contractABI,
      methodName: 'changeOwner',
      params: [identity, newOwner]
    }

    return await this.getRawTx(txData)
  }

  async setAttributeTx(identity, key, value, expiresIn, { from }) {
    const attrKey = stringToBytes32(key)
    const attrValue = attributeToHex(key, value)

    const txData = {
      from,
      to: this.registry,
      contractABI: this.contractABI,
      methodName: 'setAttribute',
      params: [
        identity,
        attrKey,
        attrValue,
        expiresIn
      ]
    }

    return await this.getRawTx(txData)
  }

  async addDelegateTx(identity, delegate, delegateType, expiresIn, { from }) {
    const txData = { 
      from,
      to: this.registry,
      contractABI: this.contractABI,
      methodName: 'addDelegate',
      params: [
        identity,
        delegateType,
        delegate,
        expiresIn
      ]
    }

    return await this.getRawTx(txData)
  }
}
