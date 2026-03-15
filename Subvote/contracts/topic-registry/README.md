# TopicRegistry

`TopicRegistry` 是按 PRD 里的 V2.0 最小接口能力实现的议题锚点合约，职责是：

- 注册 `topicHash` 和 `configHash`
- 记录加入议题行为
- 在议题关闭后锚定 `archiveHash`

## 目录

```text
contracts/topic-registry/
├─ src/
│  ├─ ITopicRegistry.sol
│  └─ TopicRegistry.sol
├─ tests/
├─ scripts/
└─ README.md
```

## 已实现接口

- `registerTopic(bytes32 topicHash, bytes32 configHash)`
- `joinTopic(bytes32 topicHash)`
- `anchorArchive(bytes32 topicHash, bytes32 archiveHash, string snapshotCid)`

## 补充接口

文档要求 `anchorArchive` 只能对“已关闭议题”执行，但最小接口清单里没有链上关闭动作。为了让这个约束能真正落在链上，合约额外补了两个能力：

- `closeTopic(bytes32 topicHash)`：由议题创建者或 operator 关闭议题
- `setOperator(address operator, bool enabled)`：由部署者配置后台执行钱包

这样可以支持两种场景：

- 用户自己注册、关闭并归档自己的议题
- 后台 worker 使用 operator 钱包代执行自动关闭和归档

## 主要约束

- `topicHash` 不能重复注册
- 同一地址不能重复加入同一议题
- 已关闭议题不能再加入
- 只有已关闭且未归档的议题才能执行 `anchorArchive`

## 工具链说明

当前仓库还没有加入 Hardhat / Foundry / solc 工具链，所以这里只先落了合约源码和目录结构，没有继续补编译脚本或测试执行配置。
