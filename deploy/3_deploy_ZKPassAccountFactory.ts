import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployZKPassAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()

  const verifier = await hre.deployments.deploy(
    'Verifier', {
      from,
      args: [],
      deterministicDeployment: true
    })
  console.log('==Verifier addr=', verifier.address)

  const entrypoint = await hre.deployments.get('EntryPoint')
  const factory = await hre.deployments.deploy(
    'ZKPassAccountFactory', {
      from,
      args: [entrypoint.address, verifier.address],
      deterministicDeployment: true
    })
  console.log('==ZKPassAccountFactory addr=', factory.address)
}

export default deployZKPassAccountFactory
