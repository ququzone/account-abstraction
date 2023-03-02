// @ts-ignore
import * as snarkjs from "snarkjs";

export async function prove(addr: BigInt, nonce: BigInt, secret: BigInt) {
    return await snarkjs.groth16.fullProve({
        addr: addr.toString(),
        nonce: nonce.toString(),
        secret: secret.toString()
    }, `${__dirname}/passport.wasm`, `${__dirname}/passport_0001.zkey`)
}
