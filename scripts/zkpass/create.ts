import { ethers } from "hardhat"
import { hexConcat, hexlify, keccak256, toUtf8Bytes } from "ethers/lib/utils"

import { ZKPassAccountFactory } from "../../typechain/"
import { EntryPoint } from "../../typechain/contracts/core/EntryPoint"
import { prove } from "./utils/prover"
import { fillAndSign } from "../../test/UserOp"
import { ZKPassSigner } from "./utils/signer"

async function main() {
    const factory = (await ethers.getContract("ZKPassAccountFactory")) as ZKPassAccountFactory
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
        BigInt(0),
        passport
    )
    const account = await factory.getAddress(admin.address, publicSignals[0], nonce)

    const code = await ethers.provider.getCode(account)
    if (code !== "0x") {
        console.log(`account ${account} already created`)
        return
    }

    const initCode = hexConcat([
        factory.address,
        factory.interface.encodeFunctionData("createAccount", [admin.address, publicSignals[0], 0]),
    ])
    const entryPoint = (await ethers.getContract("EntryPoint")) as EntryPoint

    const op = {
        initCode: initCode,
        sender: account
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
    console.log(`create account ${account} tx: ${tx.hash}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
