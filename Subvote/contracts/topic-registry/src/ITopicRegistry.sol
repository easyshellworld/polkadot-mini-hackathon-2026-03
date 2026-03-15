// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITopicRegistry {
    event TopicRegistered(address indexed creator, bytes32 indexed topicHash, bytes32 indexed configHash);
    event TopicJoined(address indexed account, bytes32 indexed topicHash);
    event ArchiveAnchored(bytes32 indexed topicHash, bytes32 indexed archiveHash, string snapshotCid);

    function registerTopic(bytes32 topicHash, bytes32 configHash) external;

    function joinTopic(bytes32 topicHash) external;

    function anchorArchive(bytes32 topicHash, bytes32 archiveHash, string calldata snapshotCid) external;
}
