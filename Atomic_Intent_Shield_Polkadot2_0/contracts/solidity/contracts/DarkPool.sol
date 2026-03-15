// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIntentVerifier {
    function verifyIntentProof(
        bytes32 intentHash,
        bytes32 nullifier,
        bytes calldata proofData,
        bytes calldata publicInputs
    ) external view returns (bool);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract DarkPool {
    enum IntentStatus {
        None,
        Pending,
        Settled,
        Cancelled
    }

    struct IntentRecord {
        address user;
        address recipient;
        bytes32 intentHash;
        bytes32 nullifier;
        IntentStatus status;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint64 deadline;
        uint64 createdAt;
    }

    struct IntentSubmission {
        address user;
        address recipient;
        bytes32 intentHash;
        bytes32 nullifier;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes proofData;
        bytes publicInputs;
        uint64 deadline;
    }

    address public owner;
    address public solver;
    address public feeRecipient;
    IIntentVerifier public verifier;

    mapping(bytes32 => IntentRecord) public intents;
    mapping(bytes32 => bool) public usedNullifiers;

    event IntentSubmitted(address indexed user, bytes32 indexed nullifier, bytes32 intentHash, uint64 deadline);
    event IntentCancelled(address indexed user, bytes32 indexed nullifier);
    event MatchSettled(bytes32 indexed nullifierA, bytes32 indexed nullifierB, bytes32 settlementId);

    error NotOwner();
    error NotSolver();
    error InvalidAddress();
    error DuplicateNullifier();
    error IntentNotFound();
    error IntentNotPending();
    error IntentExpired();
    error InvalidProof();
    error TokenPairMismatch();
    error AmountInsufficient();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlySolver() {
        if (msg.sender != solver) revert NotSolver();
        _;
    }

    constructor(address verifier_, address solver_, address feeRecipient_) {
        if (verifier_ == address(0) || solver_ == address(0) || feeRecipient_ == address(0)) {
            revert InvalidAddress();
        }
        owner = msg.sender;
        verifier = IIntentVerifier(verifier_);
        solver = solver_;
        feeRecipient = feeRecipient_;
    }

    function submitIntent(IntentSubmission calldata submission) external {
        if (usedNullifiers[submission.nullifier]) revert DuplicateNullifier();
        if (submission.deadline != 0 && block.timestamp > submission.deadline) revert IntentExpired();
        if (
            submission.user == address(0)
                || submission.recipient == address(0)
                || submission.tokenIn == address(0)
                || submission.tokenOut == address(0)
                || submission.amountIn == 0
        ) {
            revert InvalidAddress();
        }

        bool ok = verifier.verifyIntentProof(
            submission.intentHash,
            submission.nullifier,
            submission.proofData,
            submission.publicInputs
        );
        if (!ok) revert InvalidProof();

        intents[submission.nullifier] = IntentRecord({
            user: submission.user,
            recipient: submission.recipient,
            intentHash: submission.intentHash,
            nullifier: submission.nullifier,
            status: IntentStatus.Pending,
            tokenIn: submission.tokenIn,
            tokenOut: submission.tokenOut,
            amountIn: submission.amountIn,
            minAmountOut: submission.minAmountOut,
            deadline: submission.deadline,
            createdAt: uint64(block.timestamp)
        });

        usedNullifiers[submission.nullifier] = true;

        emit IntentSubmitted(submission.user, submission.nullifier, submission.intentHash, submission.deadline);
    }

    function cancelIntent(bytes32 nullifier) external {
        IntentRecord storage record = intents[nullifier];
        if (record.user == address(0)) revert IntentNotFound();
        if (record.status != IntentStatus.Pending) revert IntentNotPending();
        if (record.user != msg.sender) revert NotOwner();

        record.status = IntentStatus.Cancelled;

        emit IntentCancelled(msg.sender, nullifier);
    }

    function settleMatch(bytes32 nullifierA, bytes32 nullifierB) external onlySolver {
        IntentRecord storage a = intents[nullifierA];
        IntentRecord storage b = intents[nullifierB];

        if (a.user == address(0) || b.user == address(0)) revert IntentNotFound();
        if (a.status != IntentStatus.Pending || b.status != IntentStatus.Pending) revert IntentNotPending();

        if (a.deadline != 0 && block.timestamp > a.deadline) revert IntentExpired();
        if (b.deadline != 0 && block.timestamp > b.deadline) revert IntentExpired();

        if (a.tokenIn != b.tokenOut || a.tokenOut != b.tokenIn) revert TokenPairMismatch();
        if (a.amountIn < b.minAmountOut || b.amountIn < a.minAmountOut) revert AmountInsufficient();

        if (!IERC20(a.tokenIn).transferFrom(a.user, b.recipient, a.amountIn)) revert TransferFailed();
        if (!IERC20(b.tokenIn).transferFrom(b.user, a.recipient, b.amountIn)) revert TransferFailed();

        a.status = IntentStatus.Settled;
        b.status = IntentStatus.Settled;

        bytes32 settlementId = keccak256(abi.encodePacked(nullifierA, nullifierB, block.number));
        emit MatchSettled(nullifierA, nullifierB, settlementId);
    }

    function getIntentStatus(bytes32 nullifier) external view returns (IntentStatus) {
        return intents[nullifier].status;
    }

    function setSolver(address solver_) external onlyOwner {
        if (solver_ == address(0)) revert InvalidAddress();
        solver = solver_;
    }

    function setFeeRecipient(address feeRecipient_) external onlyOwner {
        if (feeRecipient_ == address(0)) revert InvalidAddress();
        feeRecipient = feeRecipient_;
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier_ == address(0)) revert InvalidAddress();
        verifier = IIntentVerifier(verifier_);
    }
}
