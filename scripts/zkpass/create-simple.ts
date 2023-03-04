import { ethers } from "hardhat"
import { hexConcat } from "ethers/lib/utils"

import { SimpleAccountFactory } from "../../typechain/"
import { EntryPoint } from "../../typechain/contracts/core/EntryPoint"
import { fillAndSign } from "../../test/UserOp"

async function main() {
    const factory = (await ethers.getContract("SimpleAccountFactory")) as SimpleAccountFactory
    const [from, owner] = await ethers.getSigners()
    const nonce = 0

    const account = await factory.getAddress(owner.address, nonce)

    const code = await ethers.provider.getCode(account)
    if (code !== "0x") {
        console.log(`account ${account} already created`)
        return
    }

    const initCode = hexConcat([
        factory.address,
        factory.interface.encodeFunctionData("createAccount", [owner.address, 0]),
    ])
    const entryPoint = (await ethers.getContract("EntryPoint")) as EntryPoint

    const op = {
        initCode: initCode,
        sender: account
    }

    const signedOp = await fillAndSign(op, owner, entryPoint)

    const staked = await entryPoint.balanceOf(account)
    if (staked.toString() === "0") {
        await entryPoint.depositTo(account, {value: ethers.utils.parseEther("5")})
    }

    const err = await entryPoint.callStatic.simulateValidation(signedOp).catch((e) => e)
    if (err.errorName === "FailedOp") {
        console.error(`simulate op error: ${err.errorArgs.at(-1)}`)
    } else if (err.errorName !== "ValidationResult") {
        console.error(`unknow error: ${err}`)
    }

    const tx = await entryPoint.handleOps([signedOp], from.address)
    console.log(`create account ${account} tx: ${tx.hash}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
