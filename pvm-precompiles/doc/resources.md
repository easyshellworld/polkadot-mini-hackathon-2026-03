# Project Documentation

Documentation is provided close to the logic of the application, which is a cleaner approach for readability, but references are added here for smoother navigation.

1. [Project Overview](../backend/README.md)
2. [Precompile Test Vectors](../backend/crates/README.md)
3. [BLS Spcification](../backend/crates/bls12_381/README.md)
4. [Schnorr verification specification](../backend/crates/schnorr/README.md)
5. [PVM Cli](../backend/pvm-cli/README.md)
6. [Solidity precompile library](../frontend/README.md)

## Setup local node

To setup your local polkadot-sdk node to test these implementation, it is crusial to have a local node useful for testing. Fork the [repository](https://github.com/bolajahmad/polkadot-sdk/tree/benchmarking)

```
git clone git@github.com:bolajahmad/polkadot-sdk.git
cd polkadot-sdk
git checkout benchmarking (or use the commit @ 7939a0b0f099970c74b08651223f65c866bf7a9e)
cargo build --release 
cargo build -p pallet-revive-eth-rpc --release 
```
