import { ethers } from "hardhat"
import { defaultAbiCoder, hexConcat, hexlify, keccak256, toUtf8Bytes } from "ethers/lib/utils"

import { ZKPassAccountFactory } from "../../typechain/"
import { EntryPoint } from "../../typechain/contracts/core/EntryPoint"
import { prove } from "./utils/prover"
import { fillAndSign } from "../../test/UserOp"
import { ZKPassSigner } from "./utils/signer"

async function main() {
    const factory = (await ethers.getContract("ZKPassAccountFactory")) as ZKPassAccountFactory
    const accountTpl = await ethers.getContractFactory("ZKPassAccount")
    const [from, admin] = await ethers.getSigners()
    const password = process.env.PASSWORD
    const nonce = 0

    // TODO:
    // 1. how to verify admin by proof  
    // 2. how to deal with change admin address?
    const passport = BigInt(keccak256(
        hexConcat([admin.address, hexlify(toUtf8Bytes(password!))])
    ))
    const {publicSignals} = await prove(
        BigInt(0),
        BigInt(0),
        passport
    )
    const account = await factory.getAddress(admin.address, publicSignals[0], 0)

    const code = await ethers.provider.getCode(account)
    if (code === "0x") {
        console.log(`account ${account} doesn't create`)
        return
    }

    const entryPoint = (await ethers.getContract("EntryPoint")) as EntryPoint

    const callData = accountTpl.interface.encodeFunctionData("execute", [
        "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        ethers.utils.parseEther("3"),
        "0x",
    ])
    const op = {
        sender: account,
        callData
    }

    const balance = await ethers.provider.getBalance(account)
    if (balance.lt(ethers.utils.parseEther("3"))) {
        await ethers.provider.getSigner().sendTransaction({ to: account, value: ethers.utils.parseEther("3") })
    }

    const signer = new ZKPassSigner(account, admin.address, password!, nonce)
    const signedOp = await fillAndSign(op, signer, entryPoint)

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
    console.log(`transfer ether tx: ${tx.hash}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
