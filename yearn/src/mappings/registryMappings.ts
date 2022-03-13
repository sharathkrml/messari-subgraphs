import { BigInt, Address, BigDecimal, log, ethereum } from "@graphprotocol/graph-ts"
import {
  NewExperimentalVault,
  NewVault,
} from "../../generated/Registry/Registry"
import {
  Vault as VaultContract,
} from "../../generated/Registry/Vault"
import { Vault as VaultTemplate } from "../../generated/templates"
import {
  YieldAggregator,
  Vault as VaultStore,
  VaultFee
} from "../../generated/schema"
import { getOrCreateToken } from "../common/tokens"
import {
  BIGDECIMAL_ZERO,
  PROTOCOL_ID,
  NETWORK_ETHEREUM,
  PROTOCOL_TYPE_YIELD,
  PERFORMANCE_FEE,
  MANAGEMENT_FEE
} from "../common/constants"
import { bigIntToPercentage } from "../common/utils"

function createProtocol(): void {
  let protocol = YieldAggregator.load(PROTOCOL_ID)
  if (!protocol) {
    protocol = new YieldAggregator(PROTOCOL_ID)
    protocol.name = "Yearn v2"
    protocol.slug = "yearn-v2"
    protocol.network = NETWORK_ETHEREUM
    protocol.type = PROTOCOL_TYPE_YIELD
    protocol.save()
  }
}

export function handleNewVault(event: NewVault): void {
  createProtocol()
  getOrCreateVault(event.params.vault, event)
}

export function handleNewExperimentalVault(event: NewExperimentalVault): void {
  createProtocol()
  getOrCreateVault(event.params.vault, event)
}

function getOrCreateVault(vaultAddress: Address, event: ethereum.Event): VaultStore {
  // Note that the NewVault event are also emitted when endorseVault and newRelease
  // are called. So we only create it when necessary.
  let vault = VaultStore.load(vaultAddress.toHexString())
  if (!vault) {
    vault = new VaultStore(vaultAddress.toHexString())
    const vaultContract = VaultContract.bind(Address.fromString(vault.id))
    vault.protocol = PROTOCOL_ID
    vault.name = vaultContract.name()
    vault.symbol = vaultContract.symbol()
    const inputToken = getOrCreateToken(vaultContract.token())
    vault.inputTokens = [inputToken.id]
    vault.inputTokenBalances = [BIGDECIMAL_ZERO]
    const outputToken = getOrCreateToken(Address.fromString(vault.id))
    vault.outputToken = outputToken.id
    vault.outputTokenSupply = BIGDECIMAL_ZERO
    vault.totalVolumeUSD = BIGDECIMAL_ZERO
    vault.totalValueLockedUSD = BIGDECIMAL_ZERO
    vault.createdBlockNumber = event.block.number
    vault.createdTimestamp = event.block.timestamp

    const managementFeeId = "management-fee-" + vault.id
    let managementFee = new VaultFee(managementFeeId)
    managementFee.feeType = MANAGEMENT_FEE
    managementFee.feePercentage = bigIntToPercentage(vaultContract.managementFee())
    managementFee.save()

    const performanceFeeId = "performance-fee-" + vault.id
    let performanceFee = new VaultFee(performanceFeeId)
    performanceFee.feeType = PERFORMANCE_FEE
    performanceFee.feePercentage = bigIntToPercentage(vaultContract.performanceFee())
    performanceFee.save()

    vault.fees = [managementFeeId, performanceFeeId]
    vault.save()
  
    VaultTemplate.create(vaultAddress)
  }

  return vault
}