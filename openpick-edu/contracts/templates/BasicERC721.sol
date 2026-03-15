// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BasicNFT
 * @author openpick
 * @notice A minimal ERC721 NFT contract with URI storage and safe minting
 * @dev Built on top of OpenZeppelin's ERC721URIStorage and Ownable contracts
 */
contract BasicNFT is ERC721URIStorage, Ownable {
    /// @dev The next token ID to be minted (auto-incremented)
    uint256 private _nextTokenId;

    /**
     * @notice Initializes the NFT collection with a name and symbol
     * @param name The name of the NFT collection (e.g. "MyNFT")
     * @param symbol The symbol of the NFT collection (e.g. "MNFT")
     */ 
    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}
    
    /**
     * @notice Safely mints a new NFT
     * @dev Only callable by the contract owner. Token IDs are generated sequentially.
     * @param to The address that will receive the newly minted NFT
     * @param uri The metadata URI of the NFT (e.g. IPFS or HTTPS URL)
     */
    function safeMint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @notice Returns the metadata URI for a given token ID
     * @dev Inherited from ERC721URIStorage; reverts if the token does not exist
     * @param tokenId The unique identifier of the NFT
     * @return The metadata URI associated with the given token ID
     */
    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /**
     * @notice Checks whether the contract supports a given interface (ERC165)
     * @dev Used for interface detection such as ERC721 and ERC721Metadata
     * @param interfaceId The interface identifier, as specified in ERC165
     * @return True if the contract implements the requested interface
     */    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}