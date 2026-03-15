# Subvote Subgraph

这是一个独立于前端的 `apps/subgraph/` 工程，用来在 `Polkadot Hub TestNet` 上索引合约事件。

当前模板默认只做一件事：监听一个占位的 `VoteCast` 事件，并把它写进 `VoteCast` 实体。这样做的目的是先把 `codegen -> build -> deploy -> query` 的链路跑通，再替换成你自己的合约 ABI 和事件。

## 目录结构

```text
apps/subgraph/
  abis/SubvoteContract.json
  local/docker-compose.yml
  local/initdb/01-extensions.sql
  networks.json
  package.json
  schema.graphql
  src/mapping.ts
  subgraph.yaml
```

## 本地安装

```bash
pnpm install
```

## 本地运行 Graph Node

默认会连官方 `Polkadot Hub TestNet` RPC:

```bash
pnpm subgraph:docker:up
```

如果你要切到自己的 RPC，可以先在 `apps/subgraph/.env.example` 基础上复制一份 `.env` 到 `apps/subgraph/.env`，再改这两个变量：

```bash
GRAPH_ETHEREUM_RPC=polkadot-hub-testnet:http://host.docker.internal:8545
POSTGRES_PASSWORD=let-me-in
```

如果你自己的节点支持 `archive,traces`，把第一行改成：

```bash
GRAPH_ETHEREUM_RPC=polkadot-hub-testnet:archive,traces:http://host.docker.internal:8545
```

## 生成和构建

```bash
pnpm subgraph:codegen
pnpm subgraph:build
```

## 部署到本地 Graph Node

```bash
pnpm subgraph:create-local
pnpm subgraph:deploy-local
```

查询入口：

```text
http://127.0.0.1:8000/subgraphs/name/subvote/example
```

示例查询：

```graphql
{
  voteCasts(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
    id
    proposalId
    voter
    choice
    transactionHash
    blockNumber
    blockTimestamp
  }
}
```

## 你接下来要替换的地方

在真正部署前，至少要改下面四处：

1. `apps/subgraph/subgraph.yaml` 里的 `source.address`
2. `apps/subgraph/subgraph.yaml` 里的 `startBlock`
3. `apps/subgraph/abis/SubvoteContract.json` 里的 ABI
4. `apps/subgraph/src/mapping.ts` 和 `apps/subgraph/schema.graphql` 里的实体定义

如果你的真实事件不是 `VoteCast(uint256,address,string)`，还要同步修改：

- `apps/subgraph/subgraph.yaml` 里的 `eventHandlers`
- `apps/subgraph/src/mapping.ts` 的事件参数读取

## 当前模板的限制

- 现在的 ABI 是占位 ABI，不是你的生产合约 ABI
- 当前默认 RPC 只适合事件索引
- 如果你需要 `callHandlers`、`eth_call` 或更复杂的 block handler，建议切到你自己的 archive/traces RPC
