// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DuelPlatform
 * @dev Decentralized 1v1 prediction/duel smart contract
 * @author DotDuel Team
 * @notice Version: v2.0.0
 */
contract DuelPlatform is Ownable, ReentrancyGuard, Pausable {

    string public constant VERSION = "v2.0.0";

    // ============ Enums ============

    enum MatchMode {
        REFEREE,    // Referee mode - human judge
        API         // Oracle/API auto mode
    }

    enum MatchStatus {
        WAITING,        // Waiting for opponent
        IN_PROGRESS,    // Match in progress
        COMPLETED,      // Match completed
        CANCELLED       // Match cancelled
    }
    
    // ============ Data Structures ============
    
    struct Match {
        uint256 matchId;
        MatchMode mode;
        address referee;
        address[2] participants;
        uint256 stakeAmount;
        MatchStatus status;
        address winner;
        uint256 createdAt;
        uint256 startTime;
        uint256 endTime;
        string description;
        string externalMatchId;
        bool isSettled;
    }
    
    struct UserStats {
        uint256 totalMatches;
        uint256 wonMatches;
        uint256 totalStaked;
        uint256 totalWon;
    }
    
    // ============ State Variables ============
    
    uint256 public matchCounter;
    mapping(uint256 => Match) public matches;
    mapping(string => uint256) public externalMatchIds;
    mapping(address => UserStats) public userStats;
    mapping(address => uint256[]) public userMatches;
    
    address public oracleAddress;
    mapping(address => bool) public authorizedOracles;
    
    address public platformWallet;
    
    // Fee rates (basis points: 1 = 0.01%)
    uint256 public constant REFEREE_FEE_RATE = 300;  // 3%
    uint256 public constant PLATFORM_FEE_RATE = 50;  // 0.5%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Time constraints
    uint256 public constant MIN_MATCH_DURATION = 1 hours;
    uint256 public constant MAX_MATCH_DURATION = 30 days;
    
    // ============ Events ============
    
    event MatchCreated(
        uint256 indexed matchId,
        MatchMode mode,
        address indexed creator,
        uint256 stakeAmount,
        string description
    );
    
    event ParticipantJoined(
        uint256 indexed matchId,
        address indexed participant,
        uint8 position
    );
    
    event MatchStarted(
        uint256 indexed matchId,
        address indexed participant1,
        address indexed participant2,
        uint256 startTime
    );
    
    event MatchSettled(
        uint256 indexed matchId,
        address indexed winner,
        uint256 winnerAmount,
        uint256 refereeFee,
        uint256 platformFee
    );
    
    event MatchCancelled(
        uint256 indexed matchId,
        string reason
    );
    
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event PlatformWalletUpdated(address indexed oldWallet, address indexed newWallet);
    
    // ============ Modifiers ============
    
    modifier onlyOracle() {
        require(
            authorizedOracles[msg.sender] || msg.sender == oracleAddress,
            "Not authorized oracle"
        );
        _;
    }
    
    modifier matchExists(uint256 _matchId) {
        require(_matchId < matchCounter, "Match does not exist");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _platformWallet, address _oracleAddress) Ownable(msg.sender) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        require(_oracleAddress != address(0), "Invalid oracle address");
        
        platformWallet = _platformWallet;
        oracleAddress = _oracleAddress;
        authorizedOracles[_oracleAddress] = true;
        
        emit PlatformWalletUpdated(address(0), _platformWallet);
        emit OracleUpdated(address(0), _oracleAddress);
    }
    
    // ============ Core Functions ============

    /**
     * @dev Create a new match/duel
     */
    function createMatch(
        MatchMode _mode,
        uint256 _stakeAmount,
        uint256 _startTime,
        uint256 _endTime,
        string memory _description,
        string memory _externalMatchId
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        require(_stakeAmount > 0, "Stake amount must be greater than zero");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_endTime - _startTime >= MIN_MATCH_DURATION, "Match duration too short");
        require(_endTime - _startTime <= MAX_MATCH_DURATION, "Match duration too long");
        
        // API mode requires external match ID
        if (_mode == MatchMode.API) {
            require(bytes(_externalMatchId).length > 0, "External match ID required for API mode");
            require(externalMatchIds[_externalMatchId] == 0, "External match ID already used");
        }
        
        // If creator also joins, they must pay the stake amount
        if (msg.value > 0) {
            require(msg.value == _stakeAmount, "Incorrect stake amount");
        }
        
        uint256 matchId = matchCounter++;
        
        Match storage newMatch = matches[matchId];
        newMatch.matchId = matchId;
        newMatch.mode = _mode;
        newMatch.referee = (_mode == MatchMode.REFEREE) ? msg.sender : address(0);
        newMatch.stakeAmount = _stakeAmount;
        newMatch.status = MatchStatus.WAITING;
        newMatch.createdAt = block.timestamp;
        newMatch.startTime = _startTime;
        newMatch.endTime = _endTime;
        newMatch.description = _description;
        newMatch.externalMatchId = _externalMatchId;
        
        // If creator joins immediately
        if (msg.value > 0) {
            newMatch.participants[0] = msg.sender;
            userMatches[msg.sender].push(matchId);
            emit ParticipantJoined(matchId, msg.sender, 0);
        }
        
        if (bytes(_externalMatchId).length > 0) {
            externalMatchIds[_externalMatchId] = matchId;
        }
        
        emit MatchCreated(matchId, _mode, msg.sender, _stakeAmount, _description);
        
        return matchId;
    }
    
    /**
     * @dev Join an existing match
     */
    function joinMatch(uint256 _matchId) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        matchExists(_matchId) 
    {
        Match storage matchData = matches[_matchId];
        
        require(matchData.status == MatchStatus.WAITING || matchData.status == MatchStatus.IN_PROGRESS, "Match is not accepting participants");
        require(msg.value == matchData.stakeAmount, "Incorrect stake amount");
        require(block.timestamp < matchData.startTime, "Match has already started");
        require(
            matchData.participants[0] != msg.sender && matchData.participants[1] != msg.sender,
            "Already joined"
        );
        
        // Find empty slot
        uint8 position;
        if (matchData.participants[0] == address(0)) {
            matchData.participants[0] = msg.sender;
            position = 0;
        } else if (matchData.participants[1] == address(0)) {
            matchData.participants[1] = msg.sender;
            position = 1;
        } else {
            revert("Match is full");
        }
        
        userMatches[msg.sender].push(_matchId);
        emit ParticipantJoined(_matchId, msg.sender, position);
        
        // If both participants joined, start the match
        if (matchData.participants[0] != address(0) && matchData.participants[1] != address(0)) {
            matchData.status = MatchStatus.IN_PROGRESS;
            emit MatchStarted(
                _matchId,
                matchData.participants[0],
                matchData.participants[1],
                matchData.startTime
            );
        }
    }
    
    /**
     * @dev Submit result by referee (Mode 1)
     */
    function submitResultByReferee(uint256 _matchId, address _winner)
        external
        whenNotPaused
        nonReentrant
        matchExists(_matchId)
    {
        Match storage matchData = matches[_matchId];
        
        require(matchData.mode == MatchMode.REFEREE, "Not referee mode");
        require(msg.sender == matchData.referee, "Only referee can submit result");
        require(matchData.status == MatchStatus.IN_PROGRESS, "Match is not in progress");
        require(block.timestamp >= matchData.endTime, "Match has not ended yet");
        require(
            _winner == matchData.participants[0] || _winner == matchData.participants[1],
            "Winner must be a participant"
        );
        
        matchData.winner = _winner;
        _settleMatch(_matchId);
    }
    
    /**
     * @dev Submit result by oracle (Mode 2)
     */
    function submitResultByOracle(uint256 _matchId, address _winner)
        external
        whenNotPaused
        nonReentrant
        onlyOracle
        matchExists(_matchId)
    {
        Match storage matchData = matches[_matchId];
        
        require(matchData.mode == MatchMode.API, "Not API mode");
        require(matchData.status == MatchStatus.IN_PROGRESS, "Match is not in progress");
        require(block.timestamp >= matchData.endTime, "Match has not ended yet");
        require(
            _winner == matchData.participants[0] || _winner == matchData.participants[1],
            "Winner must be a participant"
        );
        
        matchData.winner = _winner;
        _settleMatch(_matchId);
    }
    
    /**
     * @dev Internal settlement function
     */
    function _settleMatch(uint256 _matchId) internal {
        Match storage matchData = matches[_matchId];
        
        uint256 totalPool = matchData.stakeAmount * 2;
        uint256 refereeFee = 0;
        uint256 platformFee = 0;
        uint256 winnerAmount = 0;
        
        if (matchData.mode == MatchMode.REFEREE) {
            // Mode 1: Referee 3% + Platform 0.5%
            refereeFee = (totalPool * REFEREE_FEE_RATE) / FEE_DENOMINATOR;
            platformFee = (totalPool * PLATFORM_FEE_RATE) / FEE_DENOMINATOR;
            winnerAmount = totalPool - refereeFee - platformFee;
            
            // Transfer to referee
            (bool refereeSuccess, ) = payable(matchData.referee).call{value: refereeFee}("");
            require(refereeSuccess, "Referee transfer failed");
        } else {
            // Mode 2: Platform 0.5%
            platformFee = (totalPool * PLATFORM_FEE_RATE) / FEE_DENOMINATOR;
            winnerAmount = totalPool - platformFee;
        }
        
        // Transfer to platform
        (bool platformSuccess, ) = payable(platformWallet).call{value: platformFee}("");
        require(platformSuccess, "Platform transfer failed");
        
        // Transfer to winner
        (bool winnerSuccess, ) = payable(matchData.winner).call{value: winnerAmount}("");
        require(winnerSuccess, "Winner transfer failed");
        
        // Update status
        matchData.status = MatchStatus.COMPLETED;
        matchData.isSettled = true;
        
        // Update user statistics
        _updateUserStats(matchData);
        
        emit MatchSettled(_matchId, matchData.winner, winnerAmount, refereeFee, platformFee);
    }
    
    /**
     * @dev Cancel a match
     */
    function cancelMatch(uint256 _matchId)
        external
        whenNotPaused
        nonReentrant
        matchExists(_matchId)
    {
        Match storage matchData = matches[_matchId];
        
        require(matchData.status == MatchStatus.WAITING, "Can only cancel waiting matches");
        require(
            block.timestamp >= matchData.startTime ||
            msg.sender == matchData.referee ||
            (matchData.participants[0] == msg.sender && matchData.participants[1] == address(0)),
            "Not authorized to cancel"
        );
        
        // Refund participants' stakes
        for (uint8 i = 0; i < 2; i++) {
            if (matchData.participants[i] != address(0)) {
                (bool success, ) = payable(matchData.participants[i]).call{
                    value: matchData.stakeAmount
                }("");
                require(success, "Refund failed");
            }
        }
        
        matchData.status = MatchStatus.CANCELLED;
        emit MatchCancelled(_matchId, "Match cancelled");
    }
    
    /**
     * @dev Update user statistics after match settlement
     */
    function _updateUserStats(Match storage matchData) internal {
        address winner = matchData.winner;
        address loser = matchData.participants[0] == winner 
            ? matchData.participants[1] 
            : matchData.participants[0];
        
        // Update winner stats
        UserStats storage winnerStats = userStats[winner];
        winnerStats.totalMatches++;
        winnerStats.wonMatches++;
        winnerStats.totalStaked += matchData.stakeAmount;
        
        uint256 totalPool = matchData.stakeAmount * 2;
        uint256 winnerAmount;
        if (matchData.mode == MatchMode.REFEREE) {
            winnerAmount = totalPool - (totalPool * (REFEREE_FEE_RATE + PLATFORM_FEE_RATE)) / FEE_DENOMINATOR;
        } else {
            winnerAmount = totalPool - (totalPool * PLATFORM_FEE_RATE) / FEE_DENOMINATOR;
        }
        winnerStats.totalWon += winnerAmount;
        
        // Update loser stats
        UserStats storage loserStats = userStats[loser];
        loserStats.totalMatches++;
        loserStats.totalStaked += matchData.stakeAmount;
    }
    
    // ============ View Functions ============
    
    function getMatch(uint256 _matchId) external view matchExists(_matchId) returns (Match memory) {
        return matches[_matchId];
    }
    
    function getUserStats(address _user) external view returns (UserStats memory) {
        return userStats[_user];
    }
    
    function getUserMatches(address _user) external view returns (uint256[] memory) {
        return userMatches[_user];
    }
    
    function getMatchByExternalId(string memory _externalMatchId) external view returns (Match memory) {
        uint256 matchId = externalMatchIds[_externalMatchId];
        require(matchId < matchCounter, "Match not found");
        return matches[matchId];
    }
    
    // ============ Admin Functions ============
    
    function setOracle(address _oracleAddress) external onlyOwner {
        require(_oracleAddress != address(0), "Invalid oracle address");
        emit OracleUpdated(oracleAddress, _oracleAddress);
        oracleAddress = _oracleAddress;
        authorizedOracles[_oracleAddress] = true;
    }
    
    function setOracleAuthorization(address _oracle, bool _authorized) external onlyOwner {
        authorizedOracles[_oracle] = _authorized;
    }
    
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Invalid platform wallet");
        emit PlatformWalletUpdated(platformWallet, _platformWallet);
        platformWallet = _platformWallet;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Receive ============
    
    receive() external payable {
        revert("Direct transfers not allowed");
    }
}

