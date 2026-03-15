// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITopicRegistry} from "./ITopicRegistry.sol";

contract TopicRegistry is ITopicRegistry {
    error AlreadyJoined(bytes32 topicHash, address account);
    error InvalidArchiveHash();
    error InvalidConfigHash();
    error InvalidTopicHash();
    error TopicAlreadyArchived(bytes32 topicHash);
    error TopicAlreadyClosed(bytes32 topicHash);
    error TopicAlreadyRegistered(bytes32 topicHash);
    error TopicClosedForJoin(bytes32 topicHash);
    error TopicNotClosed(bytes32 topicHash);
    error TopicNotFound(bytes32 topicHash);
    error Unauthorized();
    error ZeroAddressOperator();

    struct Topic {
        address creator;
        bytes32 configHash;
        bytes32 archiveHash;
        uint64 registeredAt;
        uint64 closedAt;
        bool exists;
        bool closed;
        bool archived;
        string snapshotCid;
    }

    event OperatorUpdated(address indexed operator, bool enabled);
    event TopicClosed(address indexed executor, bytes32 indexed topicHash);

    address public immutable owner;

    mapping(address => bool) public operators;
    mapping(bytes32 => Topic) private topics;
    mapping(bytes32 => mapping(address => bool)) private topicMembers;

    constructor() {
        owner = msg.sender;
        operators[msg.sender] = true;

        emit OperatorUpdated(msg.sender, true);
    }

    function setOperator(address operator, bool enabled) external {
        if (msg.sender != owner) revert Unauthorized();
        if (operator == address(0)) revert ZeroAddressOperator();

        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function registerTopic(bytes32 topicHash, bytes32 configHash) external override {
        if (topicHash == bytes32(0)) revert InvalidTopicHash();
        if (configHash == bytes32(0)) revert InvalidConfigHash();
        if (topics[topicHash].exists) revert TopicAlreadyRegistered(topicHash);

        topics[topicHash] = Topic({
            creator: msg.sender,
            configHash: configHash,
            archiveHash: bytes32(0),
            registeredAt: uint64(block.timestamp),
            closedAt: 0,
            exists: true,
            closed: false,
            archived: false,
            snapshotCid: ""
        });

        emit TopicRegistered(msg.sender, topicHash, configHash);
    }

    function closeTopic(bytes32 topicHash) external {
        Topic storage topic = _getTopic(topicHash);

        if (!_canOperateTopic(topic.creator, msg.sender)) revert Unauthorized();
        if (topic.closed) revert TopicAlreadyClosed(topicHash);

        topic.closed = true;
        topic.closedAt = uint64(block.timestamp);

        emit TopicClosed(msg.sender, topicHash);
    }

    function joinTopic(bytes32 topicHash) external override {
        Topic storage topic = _getTopic(topicHash);

        if (topic.closed) revert TopicClosedForJoin(topicHash);
        if (topicMembers[topicHash][msg.sender]) revert AlreadyJoined(topicHash, msg.sender);

        topicMembers[topicHash][msg.sender] = true;

        emit TopicJoined(msg.sender, topicHash);
    }

    function anchorArchive(
        bytes32 topicHash,
        bytes32 archiveHash,
        string calldata snapshotCid
    ) external override {
        Topic storage topic = _getTopic(topicHash);

        if (!_canOperateTopic(topic.creator, msg.sender)) revert Unauthorized();
        if (!topic.closed) revert TopicNotClosed(topicHash);
        if (topic.archived) revert TopicAlreadyArchived(topicHash);
        if (archiveHash == bytes32(0)) revert InvalidArchiveHash();

        topic.archived = true;
        topic.archiveHash = archiveHash;
        topic.snapshotCid = snapshotCid;

        emit ArchiveAnchored(topicHash, archiveHash, snapshotCid);
    }

    function getTopic(
        bytes32 topicHash
    )
        external
        view
        returns (
            address creator,
            bytes32 configHash,
            bytes32 archiveHash,
            uint64 registeredAt,
            uint64 closedAt,
            bool closed,
            bool archived,
            string memory snapshotCid
        )
    {
        Topic storage topic = _getTopic(topicHash);

        return (
            topic.creator,
            topic.configHash,
            topic.archiveHash,
            topic.registeredAt,
            topic.closedAt,
            topic.closed,
            topic.archived,
            topic.snapshotCid
        );
    }

    function hasJoined(bytes32 topicHash, address account) external view returns (bool) {
        _getTopic(topicHash);
        return topicMembers[topicHash][account];
    }

    function _getTopic(bytes32 topicHash) internal view returns (Topic storage topic) {
        topic = topics[topicHash];

        if (!topic.exists) revert TopicNotFound(topicHash);
    }

    function _canOperateTopic(address creator, address account) internal view returns (bool) {
        return account == creator || operators[account];
    }
}
