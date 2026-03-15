# StakeManager

`StakeManager` 是按 PRD 里的 V2.0 最小接口能力实现的质押锚点合约，职责是：

- 记录用户已质押的资产数量
- 发出 stake 相关事件，供后端 worker 同步

## 目录

```text
contracts/stake-manager/
├─ src/
│  ├─ IERC20Minimal.sol
│  ├─ IStakeManager.sol
│  └─ StakeManager.sol
├─ tests/
├─ scripts/
└─ README.md
```

## 已实现接口

- `stake(uint256 amount)`
- `getStakeOf(address account)`

## 实现说明

PRD 只定义了“记录 stake 数量”和“发出事件”，没有给出底层资产模型。这里默认采用最稳妥的 EVM 方案：

- 部署时传入一个 ERC20 兼容的 `stakingAsset`
- 用户调用 `stake(amount)` 时，合约执行 `transferFrom`
- 转账成功后再更新内部 stake 余额并发出事件

这样后端同步到的 stake 数量和链上托管资产是一致的，不会出现“用户只调用函数但没有真实转入资产”的伪质押。

## 补充能力

文档里把 `StakeReduced(account, amount, newBalance)` 标成“预留”。为了给后续退出、扣减、人工纠偏留出口，合约额外补了：

- `setOperator(address operator, bool enabled)`：部署者配置后台执行钱包
- `reduceStake(address account, uint256 amount, address recipient)`：仅 operator 可调用

这两个接口不属于当前 Web 产品依赖的最小公开接口，但能支持后续扩展和后台运维。

## 主要约束

- `stake(0)` 会被拒绝
- 只有真实 `transferFrom` 成功才会记账
- `reduceStake` 只能由 operator 执行
- `reduceStake` 不能把账户余额扣成负数

## 工具链说明

当前仓库还没有加入 Hardhat / Foundry / solc 工具链，所以这里只先落了合约源码和目录结构，没有继续补编译脚本或测试执行配置。
