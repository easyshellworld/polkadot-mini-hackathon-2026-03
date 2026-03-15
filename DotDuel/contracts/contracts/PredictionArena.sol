// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PredictionArena
 * @dev Parimutuel prediction market for 1v1 matches.
 *      Creator defines two sides, crowd bets on the outcome.
 *      Creator resolves the result and earns a 2% commission.
 * @author DotDuel Team
 * @notice Version: v1.0.0
 */
contract PredictionArena is Ownable, ReentrancyGuard, Pausable {

    string public constant VERSION = "v1.0.0";

    // ============ Enums ============

    enum ArenaStatus {
        OPEN,       // Accepting bets
        LOCKED,     // Betting closed, waiting for result
        RESOLVED,   // Result submitted, payouts done
        CANCELLED   // Cancelled, refunds available
    }

    // ============ Data Structures ============

    struct Arena {
        uint256 arenaId;
        address creator;
        string title;           // e.g. "Lakers vs Warriors"
        string sideA;           // e.g. "Lakers"
        string sideB;           // e.g. "Warriors"
        string description;
        uint256 bettingDeadline;    // betting closes
        uint256 resolveDeadline;    // creator must resolve by this time
        uint256 totalSideA;         // total PAS on side A
        uint256 totalSideB;         // total PAS on side B
        ArenaStatus status;
        uint8 winningSide;          // 0 = undecided, 1 = A, 2 = B
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 betCount;
    }

    struct Bet {
        address bettor;
        uint8 side;         // 1 = side A, 2 = side B
        uint256 amount;
        uint256 timestamp;
        bool claimed;
    }

    // ============ State Variables ============

    uint256 public arenaCounter;
    mapping(uint256 => Arena) public arenas;
    mapping(uint256 => Bet[]) public arenaBets;

    // arenaId => bettor => side => total amount
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public userBetAmount;
    // arenaId => bettor => has bet
    mapping(uint256 => mapping(address => bool)) public hasBet;

    address public platformWallet;

    // Fee rates (basis points)
    uint256 public constant CREATOR_FEE_RATE = 200;    // 2%
    uint256 public constant PLATFORM_FEE_RATE = 50;     // 0.5%
    uint256 public constant FEE_DENOMINATOR = 10000;

    uint256 public constant MIN_BET = 0.001 ether;       // 0.001 PAS minimum
    uint256 public constant MIN_BETTING_PERIOD = 1 hours;
    uint256 public constant MAX_RESOLVE_EXTENSION = 7 days;

    // ============ Events ============

    event ArenaCreated(
        uint256 indexed arenaId,
        address indexed creator,
        string title,
        string sideA,
        string sideB,
        uint256 bettingDeadline,
        uint256 resolveDeadline
    );

    event BetPlaced(
        uint256 indexed arenaId,
        address indexed bettor,
        uint8 side,
        uint256 amount,
        uint256 newTotalA,
        uint256 newTotalB,
        uint256 betIndex
    );

    event ArenaResolved(
        uint256 indexed arenaId,
        uint8 winningSide,
        uint256 totalPool,
        uint256 creatorFee,
        uint256 platformFee
    );

    event ArenaCancelled(
        uint256 indexed arenaId,
        string reason
    );

    event WinningsClaimed(
        uint256 indexed arenaId,
        address indexed bettor,
        uint256 amount
    );

    event PlatformWalletUpdated(address indexed oldWallet, address indexed newWallet);

    // ============ Modifiers ============

    modifier arenaExists(uint256 _arenaId) {
        require(_arenaId < arenaCounter, "Arena does not exist");
        _;
    }

    // ============ Constructor ============

    constructor(address _platformWallet) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
        emit PlatformWalletUpdated(address(0), _platformWallet);
    }

    // ============ Core Functions ============

    /**
     * @dev Create a new prediction arena
     */
    function createArena(
        string calldata _title,
        string calldata _sideA,
        string calldata _sideB,
        string calldata _description,
        uint256 _bettingDeadline,
        uint256 _resolveDeadline
    ) external whenNotPaused returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_sideA).length > 0, "Side A name required");
        require(bytes(_sideB).length > 0, "Side B name required");
        require(_bettingDeadline > block.timestamp + MIN_BETTING_PERIOD, "Betting deadline too soon");
        require(_resolveDeadline > _bettingDeadline, "Resolve deadline must be after betting deadline");
        require(_resolveDeadline <= _bettingDeadline + MAX_RESOLVE_EXTENSION, "Resolve deadline too far");

        uint256 arenaId = arenaCounter++;

        Arena storage a = arenas[arenaId];
        a.arenaId = arenaId;
        a.creator = msg.sender;
        a.title = _title;
        a.sideA = _sideA;
        a.sideB = _sideB;
        a.description = _description;
        a.bettingDeadline = _bettingDeadline;
        a.resolveDeadline = _resolveDeadline;
        a.status = ArenaStatus.OPEN;
        a.createdAt = block.timestamp;

        emit ArenaCreated(arenaId, msg.sender, _title, _sideA, _sideB, _bettingDeadline, _resolveDeadline);

        return arenaId;
    }

    /**
     * @dev Place a bet on a side
     */
    function placeBet(uint256 _arenaId, uint8 _side)
        external
        payable
        whenNotPaused
        nonReentrant
        arenaExists(_arenaId)
    {
        Arena storage a = arenas[_arenaId];
        require(a.status == ArenaStatus.OPEN, "Arena not accepting bets");
        require(block.timestamp < a.bettingDeadline, "Betting period ended");
        require(_side == 1 || _side == 2, "Invalid side (1 or 2)");
        require(msg.value >= MIN_BET, "Bet below minimum");
        require(msg.sender != a.creator, "Creator cannot bet");

        if (_side == 1) {
            a.totalSideA += msg.value;
        } else {
            a.totalSideB += msg.value;
        }

        uint256 betIndex = arenaBets[_arenaId].length;
        arenaBets[_arenaId].push(Bet({
            bettor: msg.sender,
            side: _side,
            amount: msg.value,
            timestamp: block.timestamp,
            claimed: false
        }));

        userBetAmount[_arenaId][msg.sender][_side] += msg.value;
        hasBet[_arenaId][msg.sender] = true;
        a.betCount++;

        emit BetPlaced(_arenaId, msg.sender, _side, msg.value, a.totalSideA, a.totalSideB, betIndex);
    }

    /**
     * @dev Creator resolves the arena with the winning side
     */
    function resolveArena(uint256 _arenaId, uint8 _winningSide)
        external
        whenNotPaused
        nonReentrant
        arenaExists(_arenaId)
    {
        Arena storage a = arenas[_arenaId];
        require(msg.sender == a.creator, "Only creator can resolve");
        require(a.status == ArenaStatus.OPEN || a.status == ArenaStatus.LOCKED, "Cannot resolve");
        require(block.timestamp >= a.bettingDeadline, "Betting period not ended");
        require(block.timestamp <= a.resolveDeadline, "Resolve deadline passed");
        require(_winningSide == 1 || _winningSide == 2, "Invalid winning side");

        a.winningSide = _winningSide;
        a.status = ArenaStatus.RESOLVED;
        a.resolvedAt = block.timestamp;

        uint256 totalPool = a.totalSideA + a.totalSideB;

        if (totalPool > 0) {
            // Pay creator commission
            uint256 creatorFee = (totalPool * CREATOR_FEE_RATE) / FEE_DENOMINATOR;
            uint256 platformFee = (totalPool * PLATFORM_FEE_RATE) / FEE_DENOMINATOR;

            if (creatorFee > 0) {
                (bool cOk, ) = payable(a.creator).call{value: creatorFee}("");
                require(cOk, "Creator fee transfer failed");
            }
            if (platformFee > 0) {
                (bool pOk, ) = payable(platformWallet).call{value: platformFee}("");
                require(pOk, "Platform fee transfer failed");
            }

            emit ArenaResolved(_arenaId, _winningSide, totalPool, creatorFee, platformFee);
        } else {
            emit ArenaResolved(_arenaId, _winningSide, 0, 0, 0);
        }
    }

    /**
     * @dev Winners claim their winnings after resolution
     */
    function claimWinnings(uint256 _arenaId)
        external
        nonReentrant
        arenaExists(_arenaId)
    {
        Arena storage a = arenas[_arenaId];
        require(a.status == ArenaStatus.RESOLVED, "Arena not resolved");

        uint8 winningSide = a.winningSide;
        uint256 userWinBet = userBetAmount[_arenaId][msg.sender][winningSide];
        require(userWinBet > 0, "No winning bets");

        // Calculate payout
        uint256 totalPool = a.totalSideA + a.totalSideB;
        uint256 totalFees = (totalPool * (CREATOR_FEE_RATE + PLATFORM_FEE_RATE)) / FEE_DENOMINATOR;
        uint256 netPool = totalPool - totalFees;
        uint256 winningSideTotal = winningSide == 1 ? a.totalSideA : a.totalSideB;

        uint256 payout = (userWinBet * netPool) / winningSideTotal;

        // Mark all bets as claimed
        userBetAmount[_arenaId][msg.sender][winningSide] = 0;

        // Also zero out losing side to prevent re-entry
        uint8 losingSide = winningSide == 1 ? 2 : 1;
        userBetAmount[_arenaId][msg.sender][losingSide] = 0;

        require(payout > 0, "Nothing to claim");

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Payout transfer failed");

        emit WinningsClaimed(_arenaId, msg.sender, payout);
    }

    /**
     * @dev Cancel arena — creator before betting deadline, or anyone after resolve deadline
     */
    function cancelArena(uint256 _arenaId)
        external
        whenNotPaused
        nonReentrant
        arenaExists(_arenaId)
    {
        Arena storage a = arenas[_arenaId];
        require(a.status == ArenaStatus.OPEN || a.status == ArenaStatus.LOCKED, "Cannot cancel");

        bool isCreatorEarly = msg.sender == a.creator && a.betCount == 0;
        bool isExpired = block.timestamp > a.resolveDeadline;

        require(isCreatorEarly || isExpired, "Cannot cancel yet");

        a.status = ArenaStatus.CANCELLED;

        // Refund all bets
        Bet[] storage bets = arenaBets[_arenaId];
        for (uint256 i = 0; i < bets.length; i++) {
            if (!bets[i].claimed && bets[i].amount > 0) {
                bets[i].claimed = true;
                (bool success, ) = payable(bets[i].bettor).call{value: bets[i].amount}("");
                require(success, "Refund failed");
            }
        }

        emit ArenaCancelled(_arenaId, isExpired ? "Resolve deadline passed" : "Creator cancelled");
    }

    // ============ View Functions ============

    function getArena(uint256 _arenaId) external view arenaExists(_arenaId)
        returns (Arena memory)
    {
        return arenas[_arenaId];
    }

    function getArenaBets(uint256 _arenaId) external view arenaExists(_arenaId)
        returns (Bet[] memory)
    {
        return arenaBets[_arenaId];
    }

    function getArenaBetCount(uint256 _arenaId) external view arenaExists(_arenaId)
        returns (uint256)
    {
        return arenaBets[_arenaId].length;
    }

    function getUserBet(uint256 _arenaId, address _user)
        external view arenaExists(_arenaId)
        returns (uint256 sideAAmount, uint256 sideBAmount)
    {
        sideAAmount = userBetAmount[_arenaId][_user][1];
        sideBAmount = userBetAmount[_arenaId][_user][2];
    }

    function getOdds(uint256 _arenaId) external view arenaExists(_arenaId)
        returns (uint256 totalA, uint256 totalB, uint256 percentA, uint256 percentB)
    {
        Arena storage a = arenas[_arenaId];
        totalA = a.totalSideA;
        totalB = a.totalSideB;
        uint256 total = totalA + totalB;
        if (total > 0) {
            percentA = (totalA * 10000) / total; // basis points
            percentB = (totalB * 10000) / total;
        }
    }

    /**
     * @dev Calculate potential payout for a hypothetical bet
     */
    function calculatePayout(uint256 _arenaId, uint8 _side, uint256 _amount)
        external view arenaExists(_arenaId)
        returns (uint256 potentialPayout, uint256 multiplierBps)
    {
        Arena storage a = arenas[_arenaId];
        uint256 totalPool = a.totalSideA + a.totalSideB + _amount;
        uint256 totalFees = (totalPool * (CREATOR_FEE_RATE + PLATFORM_FEE_RATE)) / FEE_DENOMINATOR;
        uint256 netPool = totalPool - totalFees;
        uint256 sideTotal = (_side == 1 ? a.totalSideA : a.totalSideB) + _amount;

        if (sideTotal > 0) {
            potentialPayout = (_amount * netPool) / sideTotal;
            multiplierBps = (potentialPayout * 10000) / _amount;
        }
    }

    // ============ Admin Functions ============

    function setPlatformWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid address");
        address old = platformWallet;
        platformWallet = _newWallet;
        emit PlatformWalletUpdated(old, _newWallet);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
