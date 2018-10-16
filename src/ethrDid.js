import Eth from 'ethjs-query'
import HttpProvider from 'ethjs-provider-http'
import EthContract from 'ethjs-contract'
import { REGISTRY } from 'ethr-did-resolver'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
import { fromWei } from 'ethjs-unit'
import { SimpleSigner } from 'did-jwt'


import { didMethod, stringToBytes32, attributeToHex } from './formatting'
import { getUpfrontCost, sendTx, sendRawTx, signTx, calcExtraFundsRequired, getRawTx } from '../transactions'

export default class EthrDID {
  commonTxData = {
    to: REGISTRY,
    contractABI: DidRegistryABI
  }

  constructor(conf = {}) {
    if (!conf.rpcUrl) throw new Error (`Provided RPC URL is '${conf.rpcUrl}'`)

    this.ethInstance = new Eth(new HttpProvider(conf.rpcUrl))
    this.donatorAddress = conf.donatorAddress || ''

    this.didRegistryAddress = conf.didRegistryAddress || REGISTRY
    this.didRegistryInstance = new EthContract(this.ethInstance)(DidRegistryABI).at(this.didRegistryAddress)

    if (!conf.ethereumAddress) throw new Error('No address is set for EthrDid')

    this.ethereumAddress = conf.ethereumAddress
    this.did = didMethod(conf.ethereumAddress)

    if (conf.privateKey) this.signer = SimpleSigner(conf.privateKey.slice(2))

    this.withPrivateKeyOfCurrentWallet = callback => (...args) => callback(conf.privateKey, ...args)
  }

  async sendSignedTx(rawTx) {
    const sigHex = await this.withPrivateKeyOfCurrentWallet(signTx)(rawTx)
    return sendRawTx(sigHex)
  }

  async sendFundedTx(rawTx, methodName) {
    const sendTxFunctions = []

    const extra = await calcExtraFundsRequired(rawTx.from, getUpfrontCost(rawTx))
    if(extra) {
      const donatorBalance = await this.ethInstance.getBalance(this.donatorAddress, 'latest')

      if(donatorBalance.ucmp(extra) !== -1) {
        const tx = await getRawTx({
          from: this.donatorAddress,
          to: rawTx.from,
          value: extra
        })

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

  async lookupOwner() {
    const result = await this.didRegistryInstance.identityOwner(this.ethereumAddress)
    return result['0']
  }
  
  async setAttributeTx(key, value, expiresIn = 86400) {
    const owner = await this.lookupOwner()
  
    if (this.ethereumAddress !== owner) {
      throw new Error(
        `Currently selected Wallet ${this.ethereumAddress} is not the owner of ${this.ethereumAddress}. The owner is ${owner}`
    )}
  
    const attrKey = stringToBytes32(key)
    const attrValue = attributeToHex(key, value)
  
    const txData = { 
      ...this.commonTxData, 
      from: this.ethereumAddress,
      methodName: 'setAttribute',
      params: [
        this.ethereumAddress,
        attrKey,
        attrValue,
        expiresIn
      ]
    }
  
    return await getRawTx(txData)
  }
}
