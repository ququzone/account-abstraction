// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import "../../core/BaseAccount.sol";
import "../callback/TokenCallbackHandler.sol";
import "./IVerifier.sol";

contract ZKPassAccount is
    BaseAccount,
    TokenCallbackHandler,
    UUPSUpgradeable,
    Initializable
{
    event ZKPassAccountInitialized(IEntryPoint indexed entryPoint, uint256 indexed passHash);
    uint256 immutable SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    modifier onlyEntryPoint() {
        require(msg.sender == address(_entryPoint), "only EntryPoint");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == _admin, "only admin");
        _;
    }

    address private _admin;
    uint256 private _nonce;
    uint256 private _passHash;

    IEntryPoint private immutable _entryPoint;
    IVerifier private immutable _verifier;

    constructor(IEntryPoint anEntryPoint, IVerifier aVerifier) {
        _entryPoint = anEntryPoint;
        _verifier = aVerifier;
        _disableInitializers();
    }

    function nonce() public view virtual override returns (uint256) {
        return _nonce;
    }

    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    function verifier() public view returns (IVerifier) {
        return _verifier;
    }

    function initialize(address anAdmin, uint256 passHash) public virtual initializer {
        _admin = anAdmin;
        _passHash = passHash;
        emit ZKPassAccountInitialized(_entryPoint, _passHash);
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256) {
        if(verifyProof(userOp.signature, _passHash, uint256(userOpHash))) {
            return 0;
        }
        return 1;
    }

    function verifyProof(bytes calldata proof, uint256 passHash, uint256 opHash) public view returns (bool) {
        uint256[2] memory a;
        uint256[2][2] memory b;
        uint256[2] memory c;
        {
            (
                uint256 proof0,uint256 proof1,uint256 proof2,uint256 proof3,
                uint256 proof4,uint256 proof5,uint256 proof6,uint256 proof7
            ) = abi.decode(
                proof[:256], (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)
            );
            a = [proof0, proof1];
            b = [[proof2, proof3], [proof4, proof5]];
            c = [proof6, proof7];
        }
        uint256 opProof = uint256(bytes32(proof[256:]));
        
        if (opHash > SNARK_SCALAR_FIELD) {
            for (uint i = 0; i < 5; i++) {
                opHash -= SNARK_SCALAR_FIELD;
                if (opHash <= SNARK_SCALAR_FIELD) {
                    break;
                }
            }
        }
        
        uint256[5] memory input = [
            passHash,
            opProof,
            uint256(uint160(address(this))),
            _nonce,
            opHash
        ];
        return _verifier.verifyProof(a, b, c, input);
    }

    function _validateAndUpdateNonce(
        UserOperation calldata userOp
    ) internal virtual override {
        require(_nonce++ == userOp.nonce, "account: invalid nonce");
    }

    function _authorizeUpgrade(
        address /*newImplementation*/
    ) internal virtual override onlyAdmin {}

    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    function addDeposit() public payable {
        entryPoint().depositTo{value : msg.value}(address(this));
    }

    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public onlyAdmin {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function changePassHash(uint256 passHash) external onlyAdmin {
        // TODO should verify use ZKP?
        _passHash = passHash;
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value : value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function execute(address dest, uint256 value, bytes calldata func) external onlyEntryPoint {
        _call(dest, value, func);
    }

    function executeBatch(address[] calldata dest, bytes[] calldata func) external onlyEntryPoint {
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }
}
