import { TransactionRequest, Provider } from "@ethersproject/abstract-provider";
import { Bytes, Signer } from "ethers";
import { concat, defaultAbiCoder, Deferrable, hexlify, keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { prove } from "./prover";

export class ZKPassSigner extends Signer {
    private addr: bigint
    private passport: bigint
    private nonce: bigint

    constructor(addr: string, admin:string, password: string, nonce?: number) {
        super()
        this.addr = BigInt(addr)
        this.passport = BigInt(keccak256(
            concat([admin, hexlify(toUtf8Bytes(password))])
        ))
        if (nonce != null) {
            this.nonce = BigInt(nonce)
        }
    }

    public setNonce(nonce: bigint) {
        this.nonce = nonce
    }

    async signMessage(message: string | Bytes): Promise<string> {
        if (this.nonce == null) {
            throw new Error("nonce is null")
        }
        const passport = this.passport - this.addr - this.nonce;
        const {proof} = await prove(
            this.addr,
            this.nonce,
            passport
        )
        return defaultAbiCoder.encode(
            ["uint256","uint256","uint256","uint256","uint256","uint256","uint256","uint256"],
            [proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1]]
        )
    }

    getAddress(): Promise<string> {
        throw new Error("Method not implemented.")
    }

    signTransaction(transaction: Deferrable<TransactionRequest>): Promise<string> {
        throw new Error("Method not implemented.")
    }

    connect(provider: Provider): Signer {
        throw new Error("Method not implemented.")
    }
}
