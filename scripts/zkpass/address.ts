import { ethers } from "hardhat"
import { defaultAbiCoder, hexConcat, hexlify, keccak256, toUtf8Bytes } from "ethers/lib/utils"

import { ZKPassAccountFactory } from "../../typechain/"
import { EntryPoint } from "../../typechain/contracts/core/EntryPoint"
import { prove } from "./utils/prover"

async function main() {
    const factory = (await ethers.getContract("ZKPassAccountFactory")) as ZKPassAccountFactory
    const admin = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
    const password = process.env.PASSWORD

    // TODO:
    // 1. how to verify admin by proof  
    // 2. how to deal with change admin address?
    const passport = BigInt(keccak256(
        hexConcat([admin, hexlify(toUtf8Bytes(password!))])
    ))
    const {publicSignals} = await prove(
        BigInt(0),
        BigInt(0),
        BigInt(0),
        passport
    )
    // const hexProof = defaultAbiCoder.encode(
    //     ["uint256","uint256","uint256","uint256","uint256","uint256","uint256","uint256"],
    //     [proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1]]
    // )

    const address = await factory.getAddress(admin, publicSignals[0], 0)

    const initCode = hexConcat([
        factory.address,
        factory.interface.encodeFunctionData("createAccount", [admin, publicSignals[0], 0]),
    ])
    const entryPoint = (await ethers.getContract("EntryPoint")) as EntryPoint

    const entryReturnAddress = await entryPoint.callStatic
        .getSenderAddress(initCode)
        .catch((e) => e.errorArgs.sender)
    if (address != entryReturnAddress) {
        return console.error("account address dismatch")
    }

    console.log(`account address: ${address}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
