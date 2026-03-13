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
    ///         Each point in the delta values costs UPGRADE_COST_PER_POINT wei.
    ///         e.g. upgrading moveSpeed by 3 and firepower by 5 costs 8 * UPGRADE_COST_PER_POINT.
    uint256 public constant UPGRADE_COST_PER_POINT = 0.001 ether;

    /// @notice Score units required for one redemption.
    uint256 public constant SCORE_PER_REDEMPTION = 10_000;

    /// @notice PAS (in wei) awarded per redemption unit.
    uint256 public constant PAS_PER_REDEMPTION = 0.001 ether; // 1e15 wei

    event PrizePoolInitialized(address indexed initializer, uint256 amount);
    event ScoreSubmitted(address indexed player, uint256 newScore);
    event ScoreRedeemed(
        address indexed player,
        uint256 scoreSpent,
        uint256 pasReceived
    );
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

    /// @notice Submit a new score for the caller; only kept if higher than current.
    function submitScore(uint256 newScore) external {
        require(players[msg.sender].registered, "Player not registered");
        if (newScore > players[msg.sender].score) {
            players[msg.sender].score = newScore;
            emit ScoreSubmitted(msg.sender, newScore);
        }
    }

    /// @notice Redeem accumulated score for PAS tokens.
    ///         scoreToRedeem must be a multiple of SCORE_PER_REDEMPTION.
    function redeemScore(uint256 scoreToRedeem) external {
        require(players[msg.sender].registered, "Player not registered");
        require(
            scoreToRedeem > 0 && scoreToRedeem % SCORE_PER_REDEMPTION == 0,
            "scoreToRedeem must be a positive multiple of SCORE_PER_REDEMPTION"
        );
        require(
            players[msg.sender].score >= scoreToRedeem,
            "Insufficient score"
        );
        uint256 redemptions = scoreToRedeem / SCORE_PER_REDEMPTION;
        uint256 pasAmount = redemptions * PAS_PER_REDEMPTION;
        require(prizePool >= pasAmount, "Insufficient prize pool");

        players[msg.sender].score -= scoreToRedeem;
        prizePool -= pasAmount;

        (bool sent, ) = payable(msg.sender).call{value: pasAmount}("");
        require(sent, "ETH transfer failed");

        emit ScoreRedeemed(msg.sender, scoreToRedeem, pasAmount);
    }

    /// @notice Pay ETH to upgrade plane attributes.
    ///         Total cost = (moveSpeed + attackSpeed + firepower) * UPGRADE_COST_PER_POINT.
    ///         Each individual point in any attribute delta costs UPGRADE_COST_PER_POINT wei.
    ///         The payment is added to the prize pool.
    function upgradePlane(
        uint256 moveSpeed,
        uint256 attackSpeed,
        uint256 firepower
    ) public payable {
        require(players[msg.sender].registered, "Player not registered");
        uint256 totalPoints = moveSpeed + attackSpeed + firepower;
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
