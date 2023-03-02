import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployPaymaster: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const verifyingSigner = await provider.getSigner(1).getAddress()

  const entrypoint = await hre.deployments.get('EntryPoint')
  const paymaster = await hre.deployments.deploy(
    'VerifyingPaymaster', {
      from,
      args: [entrypoint.address, verifyingSigner],
      gasLimit: 6e6,
      deterministicDeployment: true
    })
  console.log('==VerifyingPaymaster addr=', paymaster.address)
}

export default deployPaymaster
