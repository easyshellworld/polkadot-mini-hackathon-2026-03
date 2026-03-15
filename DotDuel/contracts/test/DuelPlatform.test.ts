import { expect } from "chai";
import { ethers } from "hardhat";
import { DuelPlatform } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DuelPlatform - MVP 測試", function () {
  let duelPlatform: DuelPlatform;
  let owner: SignerWithAddress;
  let platformWallet: SignerWithAddress;
  let oracle: SignerWithAddress;
  let referee: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;

  beforeEach(async function () {
    [owner, platformWallet, oracle, referee, player1, player2] = await ethers.getSigners();

    const DuelPlatform = await ethers.getContractFactory("DuelPlatform");
    duelPlatform = await DuelPlatform.deploy(platformWallet.address, oracle.address);
    await duelPlatform.waitForDeployment();

    console.log("      ✓ 合約版本:", await duelPlatform.VERSION());
  });

  describe("部署", function () {
    it("應該正確設置版本號", async function () {
      expect(await duelPlatform.VERSION()).to.equal("v0.1.0-mvp");
    });

    it("應該正確設置平台錢包", async function () {
      expect(await duelPlatform.platformWallet()).to.equal(platformWallet.address);
    });

    it("應該正確設置 Oracle", async function () {
      expect(await duelPlatform.oracleAddress()).to.equal(oracle.address);
      expect(await duelPlatform.authorizedOracles(oracle.address)).to.be.true;
    });
  });

  describe("創建比賽 - 模式1（裁判模式）", function () {
    it("應該成功創建裁判模式比賽", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 7200;
      const description = "測試比賽";

      await expect(
        duelPlatform.connect(referee).createMatch(
          0, // REFEREE mode
          stakeAmount,
          startTime,
          endTime,
          description,
          "",
          { value: stakeAmount }
        )
      ).to.emit(duelPlatform, "MatchCreated")
        .withArgs(0, 0, referee.address, stakeAmount, description);

      const match = await duelPlatform.getMatch(0);
      expect(match.mode).to.equal(0);
      expect(match.referee).to.equal(referee.address);
      expect(match.stakeAmount).to.equal(stakeAmount);
      expect(match.status).to.equal(0); // WAITING
    });

    it("應該拒絕零押注金額", async function () {
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 7200;

      await expect(
        duelPlatform.connect(referee).createMatch(
          0,
          0, // 零押注
          startTime,
          endTime,
          "測試",
          ""
        )
      ).to.be.revertedWith("Stake amount must be greater than zero");
    });
  });

  describe("加入比賽", function () {
    let matchId: number;
    const stakeAmount = ethers.parseEther("1.0");

    beforeEach(async function () {
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 7200;

      await duelPlatform.connect(referee).createMatch(
        0,
        stakeAmount,
        startTime,
        endTime,
        "測試比賽",
        "",
        { value: stakeAmount }
      );
      matchId = 0;
    });

    it("應該允許玩家加入比賽", async function () {
      await expect(
        duelPlatform.connect(player1).joinMatch(matchId, { value: stakeAmount })
      ).to.emit(duelPlatform, "ParticipantJoined")
        .withArgs(matchId, player1.address, 1);

      const match = await duelPlatform.getMatch(matchId);
      expect(match.participants[1]).to.equal(player1.address);
    });

    it("應該在兩個玩家都加入後開始比賽", async function () {
      // player1 加入（referee 已經在創建時加入了，所以 player1 是第二個）
      await expect(
        duelPlatform.connect(player1).joinMatch(matchId, { value: stakeAmount })
      ).to.emit(duelPlatform, "MatchStarted");

      const match = await duelPlatform.getMatch(matchId);
      expect(match.status).to.equal(1); // IN_PROGRESS
      expect(match.participants[0]).to.equal(referee.address);
      expect(match.participants[1]).to.equal(player1.address);
    });

    it("應該拒絕錯誤的押注金額", async function () {
      const wrongAmount = ethers.parseEther("0.5");

      await expect(
        duelPlatform.connect(player1).joinMatch(matchId, { value: wrongAmount })
      ).to.be.revertedWith("Incorrect stake amount");
    });
  });

  describe("提交結果和結算", function () {
    let matchId: number;
    const stakeAmount = ethers.parseEther("1.0");

    beforeEach(async function () {
      const startTime = (await time.latest()) + 100;
      const endTime = startTime + 3600;

      // 創建比賽（裁判不加入）
      await duelPlatform.connect(referee).createMatch(
        0,
        stakeAmount,
        startTime,
        endTime,
        "測試比賽",
        ""
      );
      matchId = 0;

      // 兩個玩家加入
      await duelPlatform.connect(player1).joinMatch(matchId, { value: stakeAmount });
      await duelPlatform.connect(player2).joinMatch(matchId, { value: stakeAmount });

      // 快進到比賽結束
      await time.increaseTo(endTime + 1);
    });

    it("應該允許裁判提交結果並正確結算", async function () {
      const player1BalanceBefore = await ethers.provider.getBalance(player1.address);
      const refereeBalanceBefore = await ethers.provider.getBalance(referee.address);
      const platformBalanceBefore = await ethers.provider.getBalance(platformWallet.address);

      await expect(
        duelPlatform.connect(referee).submitResultByReferee(matchId, player1.address)
      ).to.emit(duelPlatform, "MatchSettled");

      const match = await duelPlatform.getMatch(matchId);
      expect(match.status).to.equal(2); // COMPLETED
      expect(match.winner).to.equal(player1.address);
      expect(match.isSettled).to.be.true;

      // 驗證資金分配
      const player1BalanceAfter = await ethers.provider.getBalance(player1.address);
      const refereeBalanceAfter = await ethers.provider.getBalance(referee.address);
      const platformBalanceAfter = await ethers.provider.getBalance(platformWallet.address);

      const totalPool = stakeAmount * 2n;
      const expectedRefereeFee = (totalPool * 300n) / 10000n; // 3%
      const expectedPlatformFee = (totalPool * 50n) / 10000n; // 0.5%
      const expectedWinnerAmount = totalPool - expectedRefereeFee - expectedPlatformFee;

      expect(player1BalanceAfter - player1BalanceBefore).to.equal(expectedWinnerAmount);
      expect(platformBalanceAfter - platformBalanceBefore).to.equal(expectedPlatformFee);
      // 裁判費用檢查（考慮 gas 費用）
      expect(refereeBalanceAfter).to.be.greaterThan(refereeBalanceBefore);
    });

    it("應該更新用戶統計", async function () {
      await duelPlatform.connect(referee).submitResultByReferee(matchId, player1.address);

      const player1Stats = await duelPlatform.getUserStats(player1.address);
      expect(player1Stats.totalMatches).to.equal(1);
      expect(player1Stats.wonMatches).to.equal(1);

      const player2Stats = await duelPlatform.getUserStats(player2.address);
      expect(player2Stats.totalMatches).to.equal(1);
      expect(player2Stats.wonMatches).to.equal(0);
    });
  });

  describe("取消比賽", function () {
    it("應該允許取消等待中的比賽並退款", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      const startTime = (await time.latest()) + 3600; // 給更多時間
      const endTime = startTime + 7200;

      // 創建比賽（referee 加入）
      await duelPlatform.connect(referee).createMatch(
        0,
        stakeAmount,
        startTime,
        endTime,
        "測試",
        "",
        { value: stakeAmount }
      );
      const matchId = 0;

      // 只有一個參與者，狀態仍為 WAITING

      // 快進到開始時間之後
      await time.increaseTo(startTime + 1);

      const refereeBalanceBefore = await ethers.provider.getBalance(referee.address);

      await expect(
        duelPlatform.connect(referee).cancelMatch(matchId)
      ).to.emit(duelPlatform, "MatchCancelled");

      const match = await duelPlatform.getMatch(matchId);
      expect(match.status).to.equal(3); // CANCELLED

      // 驗證退款（裁判拿回押注，扣除 gas）
      const refereeBalanceAfter = await ethers.provider.getBalance(referee.address);
      // 因為有 gas 費用，所以餘額不會完全等於之前+押注
      expect(refereeBalanceAfter).to.be.greaterThan(refereeBalanceBefore);
    });
  });

  describe("管理功能", function () {
    it("應該允許 owner 更新 Oracle", async function () {
      const newOracle = player1.address;

      await expect(
        duelPlatform.connect(owner).setOracle(newOracle)
      ).to.emit(duelPlatform, "OracleUpdated")
        .withArgs(oracle.address, newOracle);

      expect(await duelPlatform.oracleAddress()).to.equal(newOracle);
    });

    it("應該允許 owner 暫停合約", async function () {
      await duelPlatform.connect(owner).pause();

      const stakeAmount = ethers.parseEther("1.0");
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 7200;

      await expect(
        duelPlatform.connect(referee).createMatch(
          0,
          stakeAmount,
          startTime,
          endTime,
          "測試",
          ""
        )
      ).to.be.revertedWithCustomError(duelPlatform, "EnforcedPause");
    });
  });

  describe("查詢功能", function () {
    it("應該返回用戶參與的比賽列表", async function () {
      const stakeAmount = ethers.parseEther("1.0");
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 7200;

      await duelPlatform.connect(player1).createMatch(
        0,
        stakeAmount,
        startTime,
        endTime,
        "比賽1",
        "",
        { value: stakeAmount }
      );

      await duelPlatform.connect(player1).createMatch(
        0,
        stakeAmount,
        startTime + 10000,
        endTime + 10000,
        "比賽2",
        "",
        { value: stakeAmount }
      );

      const userMatches = await duelPlatform.getUserMatches(player1.address);
      expect(userMatches.length).to.equal(2);
    });
  });
});

