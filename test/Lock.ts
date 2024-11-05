import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { AddressZero } from "@ethersproject/constants";

describe("UniswapV2LiquidityPool", function () {
  // Fixture to deploy the UniswapV2LiquidityPool contract and mock tokens
  async function deployLiquidityPoolFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    // Deploy two mock ERC20 tokens
    const Token = await hre.ethers.getContractFactory("ERC20TokenMock");
    const token0 = await Token.deploy("Token0", "TK0", 1000000);
    const token1 = await Token.deploy("Token1", "TK1", 1000000);

    // Deploy the UniswapV2LiquidityPool contract with token0 and token1
    const LiquidityPool = await hre.ethers.getContractFactory("UniswapV2LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(token0, token1);

    // Mint tokens to the accounts for testing
    await token0.transfer(owner.address, 100000);
    await token1.transfer(owner.address, 100000);

    return { liquidityPool, token0, token1, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      const { liquidityPool, token0, token1 } = await loadFixture(deployLiquidityPoolFixture);

      expect(await liquidityPool.token0()).to.equal(token0);
      expect(await liquidityPool.token1()).to.equal(token1);
    });
  });

  describe("Liquidity Management", function () {
    it("Should add liquidity and emit a LiquidityAdded event", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(deployLiquidityPoolFixture);

      await token0.approve(liquidityPool, 1000);
      await token1.approve(liquidityPool, 1000);

      await expect(liquidityPool.addLiquidity(1000, 1000))
        .to.emit(liquidityPool, "LiquidityAdded")
        .withArgs(owner.address, 1000, 1000, anyValue);

      const [reserve0, reserve1] = await liquidityPool.getReserves();
      expect(reserve0).to.equal(1000);
      expect(reserve1).to.equal(1000);
    });

    it("Should revert if liquidity is removed by a non-liquidity provider", async function () {
      const { liquidityPool, otherAccount } = await loadFixture(deployLiquidityPoolFixture);

      await expect(
        liquidityPool.connect(otherAccount).removeLiquidity(100)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should allow removal of liquidity after being added", async function () {
      const { liquidityPool, token0, token1, owner } = await loadFixture(deployLiquidityPoolFixture);

      await token0.approve(liquidityPool, 1000);
      await token1.approve(liquidityPool, 1000);
      await liquidityPool.addLiquidity(1000, 1000);

      await expect(liquidityPool.removeLiquidity(1000))
        .to.emit(liquidityPool, "LiquidityRemoved")
        .withArgs(owner.address, anyValue, anyValue);
    });
  });

  describe("Swapping", function () {
    describe("Validations", function () {
      it("Should revert if attempting to swap with an invalid token", async function () {
        const { liquidityPool, otherAccount } = await loadFixture(deployLiquidityPoolFixture);

        await expect(
          liquidityPool.connect(otherAccount).swap(AddressZero, 500)
        ).to.be.revertedWith("Invalid token");
      });

      it("Should revert if trying to swap more than available reserves", async function () {
        const { liquidityPool, token0 } = await loadFixture(deployLiquidityPoolFixture);

        await token0.approve(liquidityPool, 500); // Approve enough tokens to cover the swap
await expect(liquidityPool.swap(token0, 1000))
  .to.be.revertedWith("ERC20: transfer amount exceeds allowance");

      });
    });

    describe("Successful Swaps", function () {
      it("Should swap token0 for token1 and emit a Swapped event", async function () {
        const { liquidityPool, token0, token1, owner } = await loadFixture(deployLiquidityPoolFixture);

        // Add initial liquidity
        await token0.approve(liquidityPool, 1000);
        await token1.approve(liquidityPool, 1000);
        await liquidityPool.addLiquidity(1000, 1000);

        // Approve and swap
        await token0.approve(liquidityPool, 500);
        await expect(liquidityPool.swap(token0, 500))
          .to.emit(liquidityPool, "Swapped")
          .withArgs(owner.address, token0, 500, anyValue);
      });
    });
  });
});
