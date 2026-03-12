// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AceAirCombat {
    struct Plane {
        uint256 moveSpeed;
        uint256 attackSpeed;
        uint256 firepower;
    }

    struct Player {
        bool registered;
        uint256 score;
        Plane plane;
    }

    address public owner;
    uint256 public prizePool;
    bool public prizePoolInitialized;

    mapping(address => Player) public players;

    /// @notice Cost in wei per single attribute point upgrade.
    uint256 public constant UPGRADE_COST_PER_POINT = 0.001 ether;

    event PrizePoolInitialized(address indexed initializer, uint256 amount);
    event PlaneUpgraded(
        address indexed player,
        uint256 moveSpeed,
        uint256 attackSpeed,
        uint256 firepower,
        uint256 totalCost
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Initialize the prize pool by depositing ETH into the contract.
    ///         Can only be called once by the owner.
    function initializePrizePool() external payable onlyOwner {
        require(!prizePoolInitialized, "Prize pool already initialized");
        require(msg.value > 0, "Must deposit a positive amount");

        prizePool = msg.value;
        prizePoolInitialized = true;

        emit PrizePoolInitialized(msg.sender, msg.value);
    }

    function registerPlayer() public {
        require(!players[msg.sender].registered, "Player already registered");
        players[msg.sender] = Player(true, 0, Plane(1, 1, 1));
    }

    /// @notice Pay ETH to upgrade plane attributes.
    ///         Each attribute point costs UPGRADE_COST_PER_POINT wei.
    ///         The payment is added to the prize pool.
    function upgradePlane(
        uint256 moveSpeed,
        uint256 attackSpeed,
        uint256 firepower
    ) public payable {
        require(players[msg.sender].registered, "Player not registered");
        uint256 totalPoints;
        if (moveSpeed > 0) {
            totalPoints += 1;
        } else if (attackSpeed > 0) {
            totalPoints += 1;
        } else if (firepower > 0) {
            totalPoints += 1;
        }
        require(totalPoints > 0, "Must upgrade at least one attribute");
        uint256 requiredCost = totalPoints * UPGRADE_COST_PER_POINT;
        require(msg.value == requiredCost, "Incorrect ETH amount sent");

        players[msg.sender].plane.moveSpeed += moveSpeed;
        players[msg.sender].plane.attackSpeed += attackSpeed;
        players[msg.sender].plane.firepower += firepower;
        prizePool += msg.value;

        emit PlaneUpgraded(
            msg.sender,
            moveSpeed,
            attackSpeed,
            firepower,
            msg.value
        );
    }
}
