const { expect } = require("chai");
const { ethers } = require("hardhat");

async function expectRevert(promise) {
  let reverted = false;
  try {
    await promise;
  } catch (_e) {
    reverted = true;
  }
  expect(reverted).to.equal(true);
}

describe("DarkPool", function () {
  async function deployFixture() {
    const [owner, solver, feeRecipient, userA, userB, recipientA, recipientB] = await ethers.getSigners();

    const verifierFactory = await ethers.getContractFactory("IntentVerifierMock");
    const verifier = await verifierFactory.deploy();
    await verifier.deployed();

    const darkPoolFactory = await ethers.getContractFactory("DarkPool");
    const darkPool = await darkPoolFactory.deploy(
      verifier.address,
      solver.address,
      feeRecipient.address
    );
    await darkPool.deployed();

    const tokenFactory = await ethers.getContractFactory("MockERC20");
    const tokenA = await tokenFactory.deploy("Token A", "TKA", 18);
    const tokenB = await tokenFactory.deploy("Token B", "TKB", 18);
    await tokenA.deployed();
    await tokenB.deployed();

    const amount = ethers.utils.parseEther("1000");
    await tokenA.mint(userA.address, amount);
    await tokenB.mint(userB.address, amount);

    await tokenA.connect(userA).approve(darkPool.address, amount);
    await tokenB.connect(userB).approve(darkPool.address, amount);

    return { owner, solver, userA, userB, recipientA, recipientB, darkPool, verifier, tokenA, tokenB };
  }

  it("submits intent and stores pending status", async function () {
    const { userA, darkPool } = await deployFixture();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600;

    const intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-a"));
    const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-a"));

    await darkPool.connect(userA).submitIntent({
      user: userA.address,
      recipient: userA.address,
      intentHash,
      nullifier,
      tokenIn: userA.address,
      tokenOut: userA.address,
      amountIn: 1000,
      minAmountOut: 900,
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    expect(await darkPool.getIntentStatus(nullifier)).to.equal(1);
  });

  it("rejects duplicate nullifier", async function () {
    const { userA, darkPool } = await deployFixture();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600;

    const intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-a"));
    const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-a"));

    await darkPool.connect(userA).submitIntent({
      user: userA.address,
      recipient: userA.address,
      intentHash,
      nullifier,
      tokenIn: userA.address,
      tokenOut: userA.address,
      amountIn: 1000,
      minAmountOut: 900,
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    await expectRevert(
      darkPool.connect(userA).submitIntent({
        user: userA.address,
        recipient: userA.address,
        intentHash,
        nullifier,
        tokenIn: userA.address,
        tokenOut: userA.address,
        amountIn: 1000,
        minAmountOut: 900,
        proofData: "0x1234",
        publicInputs: "0xabcd",
        deadline,
      })
    );
  });

  it("rejects proof when verifier returns false", async function () {
    const { userA, darkPool, verifier } = await deployFixture();

    await verifier.setForceResult(false);

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600;

    await expectRevert(
      darkPool.connect(userA).submitIntent({
        user: userA.address,
        recipient: userA.address,
        intentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-b")),
        nullifier: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-b")),
        tokenIn: userA.address,
        tokenOut: userA.address,
        amountIn: 1000,
        minAmountOut: 900,
        proofData: "0x1234",
        publicInputs: "0xabcd",
        deadline,
      })
    );
  });

  it("allows user to cancel own pending intent", async function () {
    const { userA, darkPool } = await deployFixture();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600;

    const intentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-c"));
    const nullifier = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-c"));

    await darkPool.connect(userA).submitIntent({
      user: userA.address,
      recipient: userA.address,
      intentHash,
      nullifier,
      tokenIn: userA.address,
      tokenOut: userA.address,
      amountIn: 1000,
      minAmountOut: 900,
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    await darkPool.connect(userA).cancelIntent(nullifier);
    expect(await darkPool.getIntentStatus(nullifier)).to.equal(3);
  });

  it("allows solver to settle complementary intents", async function () {
    const { solver, userA, userB, recipientA, recipientB, darkPool, tokenA, tokenB } = await deployFixture();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600;

    const nullifierA = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-settle-a"));
    const nullifierB = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-settle-b"));

    await darkPool.connect(userA).submitIntent({
      user: userA.address,
      recipient: recipientA.address,
      intentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-settle-a")),
      nullifier: nullifierA,
      tokenIn: tokenA.address,
      tokenOut: tokenB.address,
      amountIn: ethers.utils.parseEther("100"),
      minAmountOut: ethers.utils.parseEther("90"),
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    await darkPool.connect(userB).submitIntent({
      user: userB.address,
      recipient: recipientB.address,
      intentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-settle-b")),
      nullifier: nullifierB,
      tokenIn: tokenB.address,
      tokenOut: tokenA.address,
      amountIn: ethers.utils.parseEther("95"),
      minAmountOut: ethers.utils.parseEther("95"),
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    const recipientABalanceBBefore = await tokenB.balanceOf(recipientA.address);
    const recipientBBalanceABefore = await tokenA.balanceOf(recipientB.address);

    await darkPool.connect(solver).settleMatch(nullifierA, nullifierB);

    expect((await tokenA.balanceOf(recipientB.address)).toString()).to.equal(
      recipientBBalanceABefore.add(ethers.utils.parseEther("100")).toString()
    );
    expect((await tokenB.balanceOf(recipientA.address)).toString()).to.equal(
      recipientABalanceBBefore.add(ethers.utils.parseEther("95")).toString()
    );

    expect(Number(await darkPool.getIntentStatus(nullifierA))).to.equal(2);
    expect(Number(await darkPool.getIntentStatus(nullifierB))).to.equal(2);
  });

  it("rejects settlement from non-solver", async function () {
    const { userA, userB, darkPool, tokenA, tokenB } = await deployFixture();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const deadline = now + 3600;

    const nullifierA = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-ns-a"));
    const nullifierB = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier-ns-b"));

    await darkPool.connect(userA).submitIntent({
      user: userA.address,
      recipient: userA.address,
      intentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-ns-a")),
      nullifier: nullifierA,
      tokenIn: tokenA.address,
      tokenOut: tokenB.address,
      amountIn: ethers.utils.parseEther("100"),
      minAmountOut: ethers.utils.parseEther("90"),
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    await darkPool.connect(userB).submitIntent({
      user: userB.address,
      recipient: userB.address,
      intentHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("intent-ns-b")),
      nullifier: nullifierB,
      tokenIn: tokenB.address,
      tokenOut: tokenA.address,
      amountIn: ethers.utils.parseEther("95"),
      minAmountOut: ethers.utils.parseEther("95"),
      proofData: "0x1234",
      publicInputs: "0xabcd",
      deadline,
    });

    await expectRevert(
      darkPool.connect(userA).settleMatch(nullifierA, nullifierB)
    );
  });
});
