// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./ZKPassAccount.sol";

contract ZKPassAccountFactory {
    ZKPassAccount public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint, IVerifier _verifier) {
        accountImplementation = new ZKPassAccount(_entryPoint, _verifier);
    }

    function createAccount(address admin, uint256 passHash, uint256 salt) public returns (ZKPassAccount ret) {
        address addr = getAddress(admin, passHash, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return ZKPassAccount(payable(addr));
        }
        ret = ZKPassAccount(payable(new ERC1967Proxy{salt : bytes32(salt)}(
                address(accountImplementation),
                abi.encodeCall(ZKPassAccount.initialize, (admin, passHash))
            )));
    }

    function getAddress(address admin, uint256 passHash, uint256 salt) public view returns (address) {
        return Create2.computeAddress(bytes32(salt), keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeCall(ZKPassAccount.initialize, (admin, passHash))
                )
            )));
    }
}
