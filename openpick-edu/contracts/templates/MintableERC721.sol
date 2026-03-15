// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintableNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256 public mintPrice;
    uint256 public maxSupply;
    uint256 public maxMintPerTx;
    bool public mintingActive = false;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _mintPrice,
        uint256 _maxSupply,
        uint256 _maxMintPerTx
    ) ERC721(name, symbol) Ownable(msg.sender) {
        mintPrice = _mintPrice;
        maxSupply = _maxSupply;
        maxMintPerTx = _maxMintPerTx;
    }

    function mint(uint256 quantity) public payable {
        require(mintingActive, "Minting is not active");
        require(quantity > 0 && quantity <= maxMintPerTx, "Invalid mint quantity");
        require(_nextTokenId + quantity <= maxSupply, "Exceeds max supply");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
        }
    }

    function ownerMint(address to, string memory uri) public onlyOwner {
        require(_nextTokenId < maxSupply, "Exceeds max supply");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function setTokenURI(uint256 tokenId, string memory uri) public onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _setTokenURI(tokenId, uri);
    }

    function toggleMinting() public onlyOwner {
        mintingActive = !mintingActive;
    }

    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId;
    }
}