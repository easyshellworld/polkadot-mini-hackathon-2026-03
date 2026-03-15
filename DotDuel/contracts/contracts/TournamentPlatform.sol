// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TournamentPlatform
 * @dev Decentralized tournament bracket system with prediction markets
 * @notice Polymarket-inspired tournament platform on Polkadot/Revive
 * @author DotDuel Team
 * @notice Version: v2.0.0
 */
contract TournamentPlatform is Ownable, ReentrancyGuard, Pausable {

    string public constant VERSION = "v2.0.0";

    // ============ Enums ============

    enum TournamentStatus {
        REGISTRATION,   // 0 - Open for player registration
        IN_PROGRESS,    // 1 - Tournament started, matches ongoing
        COMPLETED,      // 2 - Tournament finished, prizes distributed
        CANCELLED       // 3 - Tournament cancelled, refunds issued
    }

    enum BracketSize {
        FOUR,       // 0 - 4 players (2 rounds)
        EIGHT,      // 1 - 8 players (3 rounds)
        SIXTEEN     // 2 - 16 players (4 rounds)
    }

    enum MatchResult {
        PENDING,    // 0 - Not yet decided
        PLAYER_ONE, // 1 - First player wins
        PLAYER_TWO  // 2 - Second player wins
    }

    // ============ Data Structures ============

    struct Tournament {
        uint256 id;
        string name;
        string description;
        address organizer;
        BracketSize bracketSize;
        uint256 entryFee;
        uint256 prizePool;
        TournamentStatus status;
        uint256 maxPlayers;
        uint256 registeredCount;
        uint256 currentRound;
        uint256 totalRounds;
        uint256 createdAt;
        uint256 registrationDeadline;
        uint256 startTime;
        bool prizesDistributed;
    }

    struct BracketMatch {
        uint256 tournamentId;
        uint256 round;
        uint256 matchIndex;
        address playerOne;
        address playerTwo;
        address winner;
        MatchResult result;
        bool isSettled;
    }

    struct Prediction {
        address predictor;
        uint256 tournamentId;
        address predictedWinner;
        uint256 amount;
        bool claimed;
    }

    struct TournamentPlayerStats {
        uint256 tournamentsEntered;
        uint256 tournamentsWon;
        uint256 matchesWon;
        uint256 matchesLost;
        uint256 totalPrizeWon;
        uint256 totalEntryFees;
    }

    // ============ State Variables ============

    uint256 public tournamentCounter;
    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => address[]) public tournamentPlayers;
    mapping(uint256 => mapping(address => bool)) public isRegistered;

    // Bracket: tournamentId => round => matchIndex => BracketMatch
    mapping(uint256 => mapping(uint256 => mapping(uint256 => BracketMatch))) public brackets;
    mapping(uint256 => uint256) public matchesPerRound;

    // Predictions: tournamentId => prediction[]
    mapping(uint256 => Prediction[]) public predictions;
    mapping(uint256 => mapping(address => bool)) public hasPredicted;
    mapping(uint256 => uint256) public predictionPool;
    mapping(uint256 => address) public tournamentWinners;

    // Placement tracking
    mapping(uint256 => address) public tournamentRunnerUp;    // 2nd place
    mapping(uint256 => address) public tournamentThirdPlace;  // 3rd place

    // Player stats
    mapping(address => TournamentPlayerStats) public playerStats;
    mapping(address => uint256[]) public playerTournaments;

    // Platform config
    address public platformWallet;
    address public oracleAddress;
    mapping(address => bool) public authorizedOracles;

    // Fee rates (basis points: 1 = 0.01%)
    uint256 public constant PLATFORM_FEE_RATE = 250;  // 2.5%
    uint256 public constant PREDICTION_FEE_RATE = 500; // 5% of prediction pool
    uint256 public constant FEE_DENOMINATOR = 10000;

    // Prize distribution (basis points of remaining pool after platform fee)
    uint256 public constant FIRST_PLACE_SHARE = 6000;   // 60%
    uint256 public constant SECOND_PLACE_SHARE = 2500;   // 25%
    uint256 public constant THIRD_PLACE_SHARE = 1500;    // 15%

    // Time constraints
    uint256 public constant MIN_REGISTRATION_PERIOD = 1 hours;
    uint256 public constant MAX_REGISTRATION_PERIOD = 14 days;

    // ============ Events ============

    event TournamentCreated(
        uint256 indexed tournamentId,
        string name,
        address indexed organizer,
        BracketSize bracketSize,
        uint256 entryFee,
        uint256 registrationDeadline
    );

    event PlayerRegistered(
        uint256 indexed tournamentId,
        address indexed player,
        uint256 playerCount
    );

    event TournamentStarted(
        uint256 indexed tournamentId,
        uint256 playerCount,
        uint256 prizePool
    );

    event BracketMatchCreated(
        uint256 indexed tournamentId,
        uint256 round,
        uint256 matchIndex,
        address playerOne,
        address playerTwo
    );

    event MatchResultSubmitted(
        uint256 indexed tournamentId,
        uint256 round,
        uint256 matchIndex,
        address indexed winner
    );

    event RoundAdvanced(
        uint256 indexed tournamentId,
        uint256 newRound
    );

    event TournamentCompleted(
        uint256 indexed tournamentId,
        address indexed winner,
        address runnerUp,
        address thirdPlace,
        uint256 firstPrize,
        uint256 secondPrize,
        uint256 thirdPrize
    );

    event TournamentCancelled(
        uint256 indexed tournamentId,
        string reason
    );

    event PredictionPlaced(
        uint256 indexed tournamentId,
        address indexed predictor,
        address indexed predictedWinner,
        uint256 amount
    );

    event PredictionClaimed(
        uint256 indexed tournamentId,
        address indexed predictor,
        uint256 payout
    );

    event PlatformWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    // ============ Modifiers ============

    modifier onlyOracle() {
        require(
            authorizedOracles[msg.sender] || msg.sender == oracleAddress || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }

    modifier tournamentExists(uint256 _tournamentId) {
        require(_tournamentId < tournamentCounter, "Tournament does not exist");
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

    // ============ Tournament Management ============

    /**
     * @dev Create a new tournament
     */
    function createTournament(
        string memory _name,
        string memory _description,
        BracketSize _bracketSize,
        uint256 _entryFee,
        uint256 _registrationDeadline,
        uint256 _startTime
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(_entryFee > 0, "Entry fee must be > 0");
        require(
            _registrationDeadline > block.timestamp + MIN_REGISTRATION_PERIOD,
            "Registration deadline too soon"
        );
        require(
            _registrationDeadline < block.timestamp + MAX_REGISTRATION_PERIOD,
            "Registration deadline too far"
        );
        require(_startTime > _registrationDeadline, "Start must be after registration");

        uint256 maxPlayers = _getMaxPlayers(_bracketSize);
        uint256 totalRounds = _getTotalRounds(_bracketSize);

        uint256 tournamentId = tournamentCounter++;

        Tournament storage t = tournaments[tournamentId];
        t.id = tournamentId;
        t.name = _name;
        t.description = _description;
        t.organizer = msg.sender;
        t.bracketSize = _bracketSize;
        t.entryFee = _entryFee;
        t.prizePool = 0;
        t.status = TournamentStatus.REGISTRATION;
        t.maxPlayers = maxPlayers;
        t.registeredCount = 0;
        t.currentRound = 0;
        t.totalRounds = totalRounds;
        t.createdAt = block.timestamp;
        t.registrationDeadline = _registrationDeadline;
        t.startTime = _startTime;
        t.prizesDistributed = false;

        emit TournamentCreated(
            tournamentId,
            _name,
            msg.sender,
            _bracketSize,
            _entryFee,
            _registrationDeadline
        );

        return tournamentId;
    }

    /**
     * @dev Register for a tournament by paying the entry fee
     */
    function registerForTournament(uint256 _tournamentId)
        external
        payable
        whenNotPaused
        nonReentrant
        tournamentExists(_tournamentId)
    {
        Tournament storage t = tournaments[_tournamentId];

        require(t.status == TournamentStatus.REGISTRATION, "Registration not open");
        require(block.timestamp < t.registrationDeadline, "Registration closed");
        require(!isRegistered[_tournamentId][msg.sender], "Already registered");
        require(t.registeredCount < t.maxPlayers, "Tournament full");
        require(msg.value == t.entryFee, "Incorrect entry fee");

        isRegistered[_tournamentId][msg.sender] = true;
        tournamentPlayers[_tournamentId].push(msg.sender);
        t.registeredCount++;
        t.prizePool += msg.value;

        // Update player stats
        playerStats[msg.sender].tournamentsEntered++;
        playerStats[msg.sender].totalEntryFees += msg.value;
        playerTournaments[msg.sender].push(_tournamentId);

        emit PlayerRegistered(_tournamentId, msg.sender, t.registeredCount);
    }

    /**
     * @dev Start the tournament and generate initial brackets
     * @notice Can be called by organizer or oracle after registration deadline
     */
    function startTournament(uint256 _tournamentId)
        external
        whenNotPaused
        nonReentrant
        tournamentExists(_tournamentId)
    {
        Tournament storage t = tournaments[_tournamentId];

        require(t.status == TournamentStatus.REGISTRATION, "Not in registration");
        require(
            msg.sender == t.organizer || authorizedOracles[msg.sender] || msg.sender == owner(),
            "Not authorized to start"
        );
        require(t.registeredCount == t.maxPlayers, "Not enough players");
        require(block.timestamp >= t.registrationDeadline || t.registeredCount == t.maxPlayers, "Registration not closed");

        t.status = TournamentStatus.IN_PROGRESS;
        t.currentRound = 1;

        // Shuffle and create first round brackets
        _generateBrackets(_tournamentId);

        emit TournamentStarted(_tournamentId, t.registeredCount, t.prizePool);
    }

    /**
     * @dev Submit match result for a bracket match
     */
    function submitMatchResult(
        uint256 _tournamentId,
        uint256 _round,
        uint256 _matchIndex,
        MatchResult _result
    )
        external
        whenNotPaused
        nonReentrant
        onlyOracle
        tournamentExists(_tournamentId)
    {
        Tournament storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.IN_PROGRESS, "Tournament not in progress");
        require(_round == t.currentRound, "Not current round");
        require(_result != MatchResult.PENDING, "Invalid result");

        BracketMatch storage m = brackets[_tournamentId][_round][_matchIndex];
        require(m.playerOne != address(0) && m.playerTwo != address(0), "Match not set");
        require(!m.isSettled, "Match already settled");

        m.result = _result;
        m.winner = _result == MatchResult.PLAYER_ONE ? m.playerOne : m.playerTwo;
        m.isSettled = true;

        address loser = m.winner == m.playerOne ? m.playerTwo : m.playerOne;

        // Update player stats
        playerStats[m.winner].matchesWon++;
        playerStats[loser].matchesLost++;

        emit MatchResultSubmitted(_tournamentId, _round, _matchIndex, m.winner);

        // Track 3rd place in semi-finals (round before final)
        if (_round == t.totalRounds - 1) {
            // Semi-final losers compete for 3rd place conceptually
            // We'll track the last semi-final loser as 3rd place
            tournamentThirdPlace[_tournamentId] = loser;
        }

        // Check if all matches in current round are settled
        _checkRoundCompletion(_tournamentId);
    }

    /**
     * @dev Place a prediction on who will win the tournament
     */
    function placePrediction(uint256 _tournamentId, address _predictedWinner)
        external
        payable
        whenNotPaused
        nonReentrant
        tournamentExists(_tournamentId)
    {
        Tournament storage t = tournaments[_tournamentId];

        require(
            t.status == TournamentStatus.REGISTRATION || t.status == TournamentStatus.IN_PROGRESS,
            "Predictions closed"
        );
        require(msg.value > 0, "Prediction amount must be > 0");
        require(isRegistered[_tournamentId][_predictedWinner], "Not a registered player");
        require(!hasPredicted[_tournamentId][msg.sender], "Already predicted");

        predictions[_tournamentId].push(Prediction({
            predictor: msg.sender,
            tournamentId: _tournamentId,
            predictedWinner: _predictedWinner,
            amount: msg.value,
            claimed: false
        }));

        hasPredicted[_tournamentId][msg.sender] = true;
        predictionPool[_tournamentId] += msg.value;

        emit PredictionPlaced(_tournamentId, msg.sender, _predictedWinner, msg.value);
    }

    /**
     * @dev Claim prediction winnings after tournament completes
     */
    function claimPrediction(uint256 _tournamentId)
        external
        whenNotPaused
        nonReentrant
        tournamentExists(_tournamentId)
    {
        Tournament storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.COMPLETED, "Tournament not completed");

        address winner = tournamentWinners[_tournamentId];
        require(winner != address(0), "No winner set");

        uint256 totalPool = predictionPool[_tournamentId];
        if (totalPool == 0) return;

        // Calculate platform fee on prediction pool
        uint256 platformFee = (totalPool * PREDICTION_FEE_RATE) / FEE_DENOMINATOR;
        uint256 distributablePool = totalPool - platformFee;

        // Calculate total amount bet on the winner
        uint256 winningBets = 0;
        uint256 userBet = 0;
        bool found = false;

        Prediction[] storage preds = predictions[_tournamentId];
        for (uint256 i = 0; i < preds.length; i++) {
            if (preds[i].predictedWinner == winner) {
                winningBets += preds[i].amount;
            }
            if (preds[i].predictor == msg.sender && !preds[i].claimed) {
                userBet = preds[i].amount;
                found = true;
                if (preds[i].predictedWinner == winner) {
                    preds[i].claimed = true;
                }
            }
        }

        require(found, "No prediction found");
        require(userBet > 0, "No bet to claim");

        // Find the user's prediction
        for (uint256 i = 0; i < preds.length; i++) {
            if (preds[i].predictor == msg.sender) {
                if (preds[i].predictedWinner != winner) {
                    preds[i].claimed = true;
                    return; // Wrong prediction, nothing to claim
                }
                break;
            }
        }

        require(winningBets > 0, "No winning bets");

        // Calculate proportional payout
        uint256 payout = (distributablePool * userBet) / winningBets;
        require(payout > 0, "No payout");

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Transfer failed");

        emit PredictionClaimed(_tournamentId, msg.sender, payout);
    }

    /**
     * @dev Cancel tournament and refund all entry fees
     */
    function cancelTournament(uint256 _tournamentId, string memory _reason)
        external
        whenNotPaused
        nonReentrant
        tournamentExists(_tournamentId)
    {
        Tournament storage t = tournaments[_tournamentId];
        require(
            t.status == TournamentStatus.REGISTRATION,
            "Can only cancel during registration"
        );
        require(
            msg.sender == t.organizer || msg.sender == owner(),
            "Not authorized"
        );

        t.status = TournamentStatus.CANCELLED;

        // Refund all registered players
        address[] storage players = tournamentPlayers[_tournamentId];
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] != address(0)) {
                (bool success, ) = payable(players[i]).call{value: t.entryFee}("");
                require(success, "Refund failed");
            }
        }

        // Refund prediction pool
        Prediction[] storage preds = predictions[_tournamentId];
        for (uint256 i = 0; i < preds.length; i++) {
            if (!preds[i].claimed && preds[i].amount > 0) {
                preds[i].claimed = true;
                (bool success, ) = payable(preds[i].predictor).call{value: preds[i].amount}("");
                require(success, "Prediction refund failed");
            }
        }

        emit TournamentCancelled(_tournamentId, _reason);
    }

    // ============ Internal Functions ============

    function _generateBrackets(uint256 _tournamentId) internal {
        Tournament storage t = tournaments[_tournamentId];
        address[] storage players = tournamentPlayers[_tournamentId];
        uint256 playerCount = players.length;

        // Simple shuffle using block data (sufficient for hackathon demo)
        for (uint256 i = playerCount - 1; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                _tournamentId,
                i
            ))) % (i + 1);
            address temp = players[i];
            players[i] = players[j];
            players[j] = temp;
        }

        // Create first round matches
        uint256 matchCount = playerCount / 2;
        matchesPerRound[_tournamentId] = matchCount;

        for (uint256 i = 0; i < matchCount; i++) {
            BracketMatch storage m = brackets[_tournamentId][1][i];
            m.tournamentId = _tournamentId;
            m.round = 1;
            m.matchIndex = i;
            m.playerOne = players[i * 2];
            m.playerTwo = players[i * 2 + 1];
            m.result = MatchResult.PENDING;
            m.isSettled = false;

            emit BracketMatchCreated(_tournamentId, 1, i, m.playerOne, m.playerTwo);
        }
    }

    function _checkRoundCompletion(uint256 _tournamentId) internal {
        Tournament storage t = tournaments[_tournamentId];
        uint256 currentMatchCount = _getMatchCountForRound(t.maxPlayers, t.currentRound);

        // Check if all matches in current round are settled
        for (uint256 i = 0; i < currentMatchCount; i++) {
            if (!brackets[_tournamentId][t.currentRound][i].isSettled) {
                return; // Not all matches settled yet
            }
        }

        // All matches settled - advance or complete
        if (t.currentRound >= t.totalRounds) {
            // Tournament complete - final match decided
            BracketMatch storage finalMatch = brackets[_tournamentId][t.currentRound][0];
            _completeTournament(_tournamentId, finalMatch.winner);
        } else {
            // Advance to next round
            _advanceRound(_tournamentId);
        }
    }

    function _advanceRound(uint256 _tournamentId) internal {
        Tournament storage t = tournaments[_tournamentId];
        uint256 currentMatchCount = _getMatchCountForRound(t.maxPlayers, t.currentRound);
        uint256 nextRound = t.currentRound + 1;
        uint256 nextMatchCount = currentMatchCount / 2;

        // Create next round matches from winners
        for (uint256 i = 0; i < nextMatchCount; i++) {
            BracketMatch storage match1 = brackets[_tournamentId][t.currentRound][i * 2];
            BracketMatch storage match2 = brackets[_tournamentId][t.currentRound][i * 2 + 1];

            BracketMatch storage nextMatch = brackets[_tournamentId][nextRound][i];
            nextMatch.tournamentId = _tournamentId;
            nextMatch.round = nextRound;
            nextMatch.matchIndex = i;
            nextMatch.playerOne = match1.winner;
            nextMatch.playerTwo = match2.winner;
            nextMatch.result = MatchResult.PENDING;
            nextMatch.isSettled = false;

            emit BracketMatchCreated(_tournamentId, nextRound, i, match1.winner, match2.winner);
        }

        t.currentRound = nextRound;
        emit RoundAdvanced(_tournamentId, nextRound);
    }

    function _completeTournament(uint256 _tournamentId, address _winner) internal {
        Tournament storage t = tournaments[_tournamentId];

        t.status = TournamentStatus.COMPLETED;
        tournamentWinners[_tournamentId] = _winner;

        // Determine runner-up (final match loser)
        BracketMatch storage finalMatch = brackets[_tournamentId][t.totalRounds][0];
        address runnerUp = finalMatch.winner == finalMatch.playerOne
            ? finalMatch.playerTwo
            : finalMatch.playerOne;
        tournamentRunnerUp[_tournamentId] = runnerUp;

        // Calculate prize distribution
        uint256 totalPool = t.prizePool;
        uint256 platformFee = (totalPool * PLATFORM_FEE_RATE) / FEE_DENOMINATOR;
        uint256 distributablePool = totalPool - platformFee;

        uint256 firstPrize = (distributablePool * FIRST_PLACE_SHARE) / FEE_DENOMINATOR;
        uint256 secondPrize = (distributablePool * SECOND_PLACE_SHARE) / FEE_DENOMINATOR;
        uint256 thirdPrize = distributablePool - firstPrize - secondPrize;

        // Transfer platform fee
        (bool platformSuccess, ) = payable(platformWallet).call{value: platformFee}("");
        require(platformSuccess, "Platform fee transfer failed");

        // Transfer prizes
        (bool firstSuccess, ) = payable(_winner).call{value: firstPrize}("");
        require(firstSuccess, "First prize transfer failed");

        (bool secondSuccess, ) = payable(runnerUp).call{value: secondPrize}("");
        require(secondSuccess, "Second prize transfer failed");

        address thirdPlace = tournamentThirdPlace[_tournamentId];
        if (thirdPlace != address(0)) {
            (bool thirdSuccess, ) = payable(thirdPlace).call{value: thirdPrize}("");
            require(thirdSuccess, "Third prize transfer failed");
        } else {
            // If no 3rd place tracked, add to first prize
            (bool extraSuccess, ) = payable(_winner).call{value: thirdPrize}("");
            require(extraSuccess, "Extra prize transfer failed");
            firstPrize += thirdPrize;
            thirdPrize = 0;
        }

        t.prizesDistributed = true;

        // Update player stats
        playerStats[_winner].tournamentsWon++;
        playerStats[_winner].totalPrizeWon += firstPrize;
        playerStats[runnerUp].totalPrizeWon += secondPrize;
        if (thirdPlace != address(0)) {
            playerStats[thirdPlace].totalPrizeWon += thirdPrize;
        }

        // Send prediction pool platform fee
        uint256 predPool = predictionPool[_tournamentId];
        if (predPool > 0) {
            uint256 predFee = (predPool * PREDICTION_FEE_RATE) / FEE_DENOMINATOR;
            if (predFee > 0) {
                (bool predFeeSuccess, ) = payable(platformWallet).call{value: predFee}("");
                require(predFeeSuccess, "Prediction fee transfer failed");
            }
        }

        emit TournamentCompleted(
            _tournamentId,
            _winner,
            runnerUp,
            thirdPlace,
            firstPrize,
            secondPrize,
            thirdPrize
        );
    }

    // ============ View Functions ============

    function getTournament(uint256 _tournamentId)
        external
        view
        tournamentExists(_tournamentId)
        returns (Tournament memory)
    {
        return tournaments[_tournamentId];
    }

    function getTournamentPlayers(uint256 _tournamentId)
        external
        view
        tournamentExists(_tournamentId)
        returns (address[] memory)
    {
        return tournamentPlayers[_tournamentId];
    }

    function getBracketMatch(uint256 _tournamentId, uint256 _round, uint256 _matchIndex)
        external
        view
        returns (BracketMatch memory)
    {
        return brackets[_tournamentId][_round][_matchIndex];
    }

    function getTournamentBracket(uint256 _tournamentId, uint256 _round)
        external
        view
        tournamentExists(_tournamentId)
        returns (BracketMatch[] memory)
    {
        Tournament storage t = tournaments[_tournamentId];
        uint256 matchCount = _getMatchCountForRound(t.maxPlayers, _round);
        BracketMatch[] memory matches = new BracketMatch[](matchCount);

        for (uint256 i = 0; i < matchCount; i++) {
            matches[i] = brackets[_tournamentId][_round][i];
        }

        return matches;
    }

    function getPredictions(uint256 _tournamentId)
        external
        view
        returns (Prediction[] memory)
    {
        return predictions[_tournamentId];
    }

    function getPlayerStats(address _player)
        external
        view
        returns (TournamentPlayerStats memory)
    {
        return playerStats[_player];
    }

    function getPlayerTournaments(address _player)
        external
        view
        returns (uint256[] memory)
    {
        return playerTournaments[_player];
    }

    function getTournamentResults(uint256 _tournamentId)
        external
        view
        tournamentExists(_tournamentId)
        returns (
            address winner,
            address runnerUp,
            address thirdPlace,
            uint256 prizePool,
            bool distributed
        )
    {
        Tournament storage t = tournaments[_tournamentId];
        return (
            tournamentWinners[_tournamentId],
            tournamentRunnerUp[_tournamentId],
            tournamentThirdPlace[_tournamentId],
            t.prizePool,
            t.prizesDistributed
        );
    }

    // ============ Helper Functions ============

    function _getMaxPlayers(BracketSize _size) internal pure returns (uint256) {
        if (_size == BracketSize.FOUR) return 4;
        if (_size == BracketSize.EIGHT) return 8;
        if (_size == BracketSize.SIXTEEN) return 16;
        revert("Invalid bracket size");
    }

    function _getTotalRounds(BracketSize _size) internal pure returns (uint256) {
        if (_size == BracketSize.FOUR) return 2;
        if (_size == BracketSize.EIGHT) return 3;
        if (_size == BracketSize.SIXTEEN) return 4;
        revert("Invalid bracket size");
    }

    function _getMatchCountForRound(uint256 _maxPlayers, uint256 _round) internal pure returns (uint256) {
        // Round 1: maxPlayers/2 matches, Round 2: maxPlayers/4, etc.
        uint256 divisor = 1;
        for (uint256 i = 0; i < _round; i++) {
            divisor *= 2;
        }
        return _maxPlayers / divisor;
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
