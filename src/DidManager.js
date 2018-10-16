import bip39 from "bip39";
import { HDNode } from "ethers";
import { SimpleSigner } from "did-jwt";
import { REGISTRY } from 'ethr-did-resolver'
import DidRegistryABI from 'ethr-did-resolver/contracts/ethr-did-registry.json'
import { BN } from 'ethereumjs-util'
import { fromWei } from "ethjs-unit";

import TransactionManager from 'TransactionManager'
import { didMethod, publicKeyToEthereumAddress, addressFromDid, privateKeyToEthereumAddress } from "./formatting";
import { waitBlock } from './transactions/waitBlock'

export default class DidManager {
  static generateDID = (conf = {}) => {
    let result = { hierarchy: !!conf.hierarchy }

    if (!conf.hierarchy) {
      const keypair = secp256k1.genKeyPair()
      result.publicKeyHex = keypair.getPublic('hex')
      result.privateKeyHex = keypair.getPrivate('hex')
    } else {
      result.mnemonic = conf.mnemonic || bip39.generateMnemonic()

      const masterNode = HDNode.fromMnemonic(result.mnemonic)

      result.derivationPathRoot = conf.derivationPathRoot || `m/44'/60'/0'/0`
      result.index = conf.index || 0

      const addressNode = masterNode.derivePath(`${result.derivationPathRoot}/${result.index}`)

      result.publicKeyHex = addressNode.publicKey
      result.privateKeyHex = addressNode.privateKey
    }

    result.ethereumAddress = publicKeyToEthereumAddress(result.publicKeyHex)
    result.did = didMethod(result.ethereumAddress)

    return result
  }

  constructor(conf) {
    if (!conf.rpcUrl) throw new Error (`Provided RPC URL is '${conf.rpcUrl}'`)

    this.ethInstance = new Eth(new HttpProvider(conf.rpcUrl))
    this.donatorAddress = conf.donatorAddress || ''

    this.didRegistryAddress = conf.didRegistryAddress || REGISTRY
    this.didRegistryInstance = new EthContract(this.ethInstance)(DidRegistryABI).at(this.didRegistryAddress)

    this.TransactionManager = new TransactionManager(this.ethInstance, REGISTRY, DidRegistryABI)
  }

  async calcExtraFundsRequired(senderAddress, amountWei) {
    const senderBalance = await this.ethInstance.getBalance(senderAddress, 'latest')
    return senderBalance.ucmp(amountWei) === -1 ? amountWei.sub(senderBalance) : new BN(0)
  }

  async lookupOwner(did) {
    const result = await this.didRegistryInstance.identityOwner(addressFromDid(did))
    return result['0']
  }

  async changeDidOwner(did, newOwner, privateKey) {
    const owner = this.lookupOwner(did)

    if(owner !== privateKeyToEthereumAddress(privateKey)) throw new Error(`You are not the owner of ${did}`)

    const rawTx = this.TransactionManager.changeOwnerTx(owner, newOwner)

    const txStatus = await this.sendFunds(rawTx)

    if(!txStatus) throw new Error('Funding transaction failed')

    const signedTx =  await this.TransactionManager.signTx(privateKey, rawTx)

    return await this.ethInstance.sendRawTransaction(signedTx)
  }

  async sendFunds(rawTx) {
    const extra = await this.calcExtraFundsRequired(rawTx.from, TransactionManager.getUpfrontCost(rawTx))

    if(extra) {
      const donatorBalance = await this.ethInstance.getBalance(this.donatorAddress, 'latest')

      if(donatorBalance.ucmp(extra) !== -1) {
        const tx = await this.TransactionManager.getRawTx({
          from: this.donatorAddress,
          to: rawTx.from,
          value: extra
        })

        const txHash = await this.ethInstance.sendTransaction(tx)
        return await waitBlock(txHash)
      } else {
        throw new Error(`Requested extra funds ${fromWei(extra, 'ether')}
           Eth is above Donator's balance ${fromWei(donatorBalance, 'ether')} Eth`)
      }
    }
  }

}