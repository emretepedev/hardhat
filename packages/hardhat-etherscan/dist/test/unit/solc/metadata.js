"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cbor_1 = require("cbor");
const chai_1 = require("chai");
const semver_1 = __importDefault(require("semver"));
const util_1 = require("util");
const metadata_1 = require("../../../src/solc/metadata");
describe("Metadata decoder tests", () => {
    const mockMetadataLengths = [0, 0x20, 100, 137, 0xff, 0x201, 523, 0xffff];
    for (const mockLength of mockMetadataLengths) {
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16BE(mockLength, 0);
        it(`decode metadata length ${mockLength}`, () => {
            const length = (0, metadata_1.getSolcMetadataSectionLength)(buffer);
            chai_1.assert.equal(length - metadata_1.METADATA_LENGTH_SIZE, mockLength, `should read length ${mockLength}`);
        });
        const gibberishBuffer = Buffer.from("testbuffer");
        const longBuffer = Buffer.concat([gibberishBuffer, buffer]);
        it(`reads length ${mockLength} from a long buffer`, () => {
            const length = (0, metadata_1.getSolcMetadataSectionLength)(longBuffer);
            chai_1.assert.equal(length - metadata_1.METADATA_LENGTH_SIZE, mockLength, `should read length ${mockLength}`);
        });
    }
    const mockPayloads = [
        "hello world",
        [1, 2, 3],
        { someKey: "test" },
        { solc: "0.6.4", ipfs: "a hash" },
    ];
    for (const mockPayload of mockPayloads) {
        const encoded = (0, cbor_1.encode)(mockPayload);
        const mockMetadata = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
        const length = Buffer.alloc(2);
        length.writeUInt16BE(mockMetadata.length, 0);
        const metadataBuffer = Buffer.concat([mockMetadata, length]);
        it(`reads ${(0, util_1.inspect)(mockPayload)} ${typeof mockPayload} from metadata`, async () => {
            const { decoded } = (0, metadata_1.decodeSolcMetadata)(metadataBuffer);
            chai_1.assert.deepEqual(decoded, mockPayload, `decoding failed`);
        });
    }
    const mockSolcMetadataMappings = [
        { solc: Buffer.from([0, 5, 11]), bzzr1: "a hash" },
        { solc: Buffer.from([0, 5, 14]), bzzr1: "another hash" },
        { solc: Buffer.from([0, 6, 7]), ipfs: "yah" },
        { solc: Buffer.from([0, 7, 0]), ipfs: "the hash" },
    ];
    const initialPadding = Buffer.from("hardhat-etherscan test padding with numbers 1234567890");
    for (const mockSolcMetadataMapping of mockSolcMetadataMappings) {
        const encoded = (0, cbor_1.encode)(mockSolcMetadataMapping);
        const mockMetadata = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
        const length = Buffer.alloc(2);
        length.writeUInt16BE(mockMetadata.length, 0);
        const metadataBuffer = Buffer.concat([
            initialPadding,
            mockMetadata,
            length,
        ]);
        it(`reads solc version from ${(0, util_1.inspect)(mockSolcMetadataMapping)} ${typeof mockSolcMetadataMapping}`, async () => {
            const { solcVersion } = (0, metadata_1.inferSolcVersion)(metadataBuffer);
            const [major, minor, patch] = mockSolcMetadataMapping.solc;
            chai_1.assert.equal(solcVersion, `${major}.${minor}.${patch}`);
        });
    }
    it("fails when given metadata of zero length", async () => {
        const length = Buffer.from([0, 0]);
        chai_1.assert.throws(() => (0, metadata_1.decodeSolcMetadata)(length));
    });
});
describe("solc version inferral tests", () => {
    describe("very old compiler inferral; these don't emit metadata", () => {
        /**
         * These tests require compiling a contract with solc v0.4.6 or earlier.
         * This is not currently possible with hardhat out of the box.
         */
        it.skip("bytecode emitted by solc v0.4.6; the last version to feature no metadata", () => { });
        // We can test with gibberish instead
        it("when payload is gibberish", async () => {
            const payload = Buffer.from("This is no contract bytecode.");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(payload);
            chai_1.assert.equal(metadataDescription.solcVersion, metadata_1.METADATA_ABSENT_VERSION_RANGE, "False positive in metadata detection");
            const veryOldVersion = "0.4.6";
            chai_1.assert.isTrue(semver_1.default.satisfies(veryOldVersion, metadataDescription.solcVersion), `${veryOldVersion} should be included in ${metadataDescription.solcVersion}`);
            const anotherVeryOldVersion = "0.4.0";
            chai_1.assert.isTrue(semver_1.default.satisfies(anotherVeryOldVersion, metadataDescription.solcVersion), `${anotherVeryOldVersion} should be included in ${metadataDescription.solcVersion}`);
            const oldVersion = "0.4.7";
            chai_1.assert.isFalse(semver_1.default.satisfies(oldVersion, metadataDescription.solcVersion), `${oldVersion} shouldn't be included in ${metadataDescription.solcVersion}`);
        });
    });
    describe("old compiler inferral; these embed metadata without solc version", () => {
        it.skip("bytecode emitted by solc v0.4.7; the first version to feature metadata", () => { });
        // The minimum solc version that can be run with hardhat out of the box.
        it("bytecode emitted by solc v0.4.12", async () => {
            const contract = {
                contractName: "TestContract",
                runtimeBytecode: "0x60606040526000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806313bdfacd1461003e575b600080fd5b341561004957600080fd5b6100516100cd565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156100925780820151818401525b602081019050610076565b50505050905090810190601f1680156100bf5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6100d5610176565b60018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561016b5780601f106101405761010080835404028352916020019161016b565b820191906000526020600020905b81548152906001019060200180831161014e57829003601f168201915b505050505090505b90565b6020604051908101604052806000815250905600a165627a7a723058201c0fc1b1566b6243fc07daa6a27c042ed8bdb3c0bbf4d9d2223339f21299056b0029",
                deployedBytecode: "0x60606040526000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806313bdfacd1461003e575b600080fd5b341561004957600080fd5b6100516100cd565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156100925780820151818401525b602081019050610076565b50505050905090810190601f1680156100bf5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6100d5610176565b60018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561016b5780601f106101405761010080835404028352916020019161016b565b820191906000526020600020905b81548152906001019060200180831161014e57829003601f168201915b505050505090505b90565b6020604051908101604052806000815250905600a165627a7a723058201c0fc1b1566b6243fc07daa6a27c042ed8bdb3c0bbf4d9d2223339f21299056b0029",
                solcVersion: "0.4.12",
                linkReferences: {},
            };
            const bytecode = Buffer.from(contract.deployedBytecode.slice(2), "hex");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(bytecode);
            chai_1.assert.isTrue(semver_1.default.satisfies(contract.solcVersion, metadataDescription.solcVersion));
            chai_1.assert.equal(metadataDescription.solcVersion, metadata_1.METADATA_PRESENT_SOLC_NOT_FOUND_VERSION_RANGE);
        });
        it("bytecode emitted by the latest solc in the 0.4 series", async () => {
            const contract = {
                contractName: "TestContract",
                runtimeBytecode: "0x608060405260043610610041576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806313bdfacd14610046575b600080fd5b34801561005257600080fd5b5061005b6100d6565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561009b578082015181840152602081019050610080565b50505050905090810190601f1680156100c85780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561016e5780601f106101435761010080835404028352916020019161016e565b820191906000526020600020905b81548152906001019060200180831161015157829003601f168201915b50505050509050905600a165627a7a72305820b6817df49c1566ffc22f6e10f7b6810c64f515e307c157f5a240574f5ebb10c70029",
                deployedBytecode: "0x608060405260043610610041576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806313bdfacd14610046575b600080fd5b34801561005257600080fd5b5061005b6100d6565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561009b578082015181840152602081019050610080565b50505050905090810190601f1680156100c85780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561016e5780601f106101435761010080835404028352916020019161016e565b820191906000526020600020905b81548152906001019060200180831161015157829003601f168201915b50505050509050905600a165627a7a72305820b6817df49c1566ffc22f6e10f7b6810c64f515e307c157f5a240574f5ebb10c70029",
                solcVersion: "0.4.26",
                linkReferences: {},
            };
            const bytecode = Buffer.from(contract.deployedBytecode.slice(2), "hex");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(bytecode);
            chai_1.assert.isTrue(semver_1.default.satisfies(contract.solcVersion, metadataDescription.solcVersion));
            chai_1.assert.equal(metadataDescription.solcVersion, metadata_1.METADATA_PRESENT_SOLC_NOT_FOUND_VERSION_RANGE);
        });
        it("bytecode emitted by solc v0.5.8; the last version to feature no solc version field", async () => {
            const contract = {
                contractName: "TestContract",
                runtimeBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea165627a7a7230582002725dc23a155ea5da565f750797acdf177aed268ecad6dd082b0df02cbcbf4c0029",
                deployedBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea165627a7a7230582002725dc23a155ea5da565f750797acdf177aed268ecad6dd082b0df02cbcbf4c0029",
                solcVersion: "0.5.8",
                linkReferences: {},
            };
            const bytecode = Buffer.from(contract.deployedBytecode.slice(2), "hex");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(bytecode);
            chai_1.assert.isTrue(semver_1.default.satisfies(contract.solcVersion, metadataDescription.solcVersion));
            chai_1.assert.equal(metadataDescription.solcVersion, metadata_1.METADATA_PRESENT_SOLC_NOT_FOUND_VERSION_RANGE);
        });
    });
    describe("exact compiler version inferral", () => {
        it("bytecode emitted by solc v0.5.9; the first compiler to feature solc version field", async () => {
            const contract = {
                contractName: "TestContract",
                runtimeBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea265627a7a723058200e0c1f0b33a8f60309ea8686e3561e5e0a9619994463519a00809a5a51f1c53664736f6c63430005090032",
                deployedBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea265627a7a723058200e0c1f0b33a8f60309ea8686e3561e5e0a9619994463519a00809a5a51f1c53664736f6c63430005090032",
                solcVersion: "0.5.9",
                linkReferences: {},
            };
            const bytecode = Buffer.from(contract.deployedBytecode.slice(2), "hex");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(bytecode);
            chai_1.assert.isTrue(semver_1.default.satisfies(contract.solcVersion, metadataDescription.solcVersion));
        });
        it("bytecode emitted by solc v0.6.0 without swarm hash nor ipfs hash", async () => {
            const contract = {
                contractName: "TestContract",
                runtimeBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea164736f6c6343000600000a",
                deployedBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea164736f6c6343000600000a",
                solcVersion: "0.6.0",
                linkReferences: {},
            };
            const bytecode = Buffer.from(contract.deployedBytecode.slice(2), "hex");
            const metadata = (0, metadata_1.decodeSolcMetadata)(bytecode);
            chai_1.assert.hasAllKeys(metadata.decoded, ["solc"], "Metadata has additional unexpected information");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(bytecode);
            chai_1.assert.isTrue(semver_1.default.satisfies(contract.solcVersion, metadataDescription.solcVersion));
        });
        it("bytecode emitted by solc v0.7.0, one of the latest compilers", async () => {
            const contract = {
                contractName: "TestContract",
                runtimeBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea2646970667358221220981f0e56fe0654616c8fd35f98d9ac6b2a7f0882184f93226486adfca553caef64736f6c63430007000033",
                deployedBytecode: "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c806313bdfacd14610030575b600080fd5b6100386100b3565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561007857808201518184015260208101905061005d565b50505050905090810190601f1680156100a55780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b606060018054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561014b5780601f106101205761010080835404028352916020019161014b565b820191906000526020600020905b81548152906001019060200180831161012e57829003601f168201915b505050505090509056fea2646970667358221220981f0e56fe0654616c8fd35f98d9ac6b2a7f0882184f93226486adfca553caef64736f6c63430007000033",
                solcVersion: "0.7.0",
                linkReferences: {},
                immutableReferences: {},
            };
            const bytecode = Buffer.from(contract.deployedBytecode.slice(2), "hex");
            const metadataDescription = (0, metadata_1.inferSolcVersion)(bytecode);
            chai_1.assert.isTrue(semver_1.default.satisfies(contract.solcVersion, metadataDescription.solcVersion));
            const [major, minor, patch] = contract.solcVersion
                .split(".")
                .map((number) => parseInt(number, 10));
            const newerVersion = `${major}.${minor}.${patch + 1}`;
            chai_1.assert.isFalse(semver_1.default.satisfies(newerVersion, metadataDescription.solcVersion), "Inference for this version range should allow only one version.");
        });
    });
});
//# sourceMappingURL=metadata.js.map