// @ts-ignore
import * as snarkjs from "snarkjs";

export async function prove(addr: BigInt, nonce: BigInt, op: BigInt, secret: BigInt) {
    return await snarkjs.groth16.fullProve({
        addr: addr.toString(),
        nonce: nonce.toString(),
        op: op.toString(),
        secret: secret.toString()
    }, `${__dirname}/passport.wasm`, `${__dirname}/passport_0001.zkey`)
}
