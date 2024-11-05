// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract UniswapV2LiquidityPool is ERC20 {
    IERC20 public token0;
    IERC20 public token1;
    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public constant FEE_PERCENTAGE = 3; // 0.3% fee on trades

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1);
    event Swapped(address indexed swapper, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(IERC20 _token0, IERC20 _token1) ERC20("LiquidityPoolToken", "LPT") {
        token0 = _token0;
        token1 = _token1;
    }

    modifier updateReserves() {
        reserve0 = token0.balanceOf(address(this));
        reserve1 = token1.balanceOf(address(this));
        _;
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external updateReserves returns (uint256 liquidity) {
        // Transfer tokens to the pool
        require(token0.transferFrom(msg.sender, address(this), amount0), "Transfer of token0 failed");
        require(token1.transferFrom(msg.sender, address(this), amount1), "Transfer of token1 failed");

        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;

        if (_reserve0 == 0 && _reserve1 == 0) {
            liquidity = sqrt(amount0 * amount1);
        } else {
            uint256 liquidity0 = (amount0 * totalSupply()) / _reserve0;
            uint256 liquidity1 = (amount1 * totalSupply()) / _reserve1;
            liquidity = min(liquidity0, liquidity1);
        }

        require(liquidity > 0, "Insufficient liquidity minted");

        // Mint liquidity tokens to the user
        _mint(msg.sender, liquidity);

        reserve0 += amount0;
        reserve1 += amount1;

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }

    function removeLiquidity(uint256 liquidity) external updateReserves returns (uint256 amount0, uint256 amount1) {
        require(balanceOf(msg.sender) >= liquidity, "Insufficient balance");

        amount0 = (liquidity * reserve0) / totalSupply();
        amount1 = (liquidity * reserve1) / totalSupply();

        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity removed");

        _burn(msg.sender, liquidity);

        token0.transfer(msg.sender, amount0);
        token1.transfer(msg.sender, amount1);

        emit LiquidityRemoved(msg.sender, amount0, amount1);
    }

    function swap(address tokenIn, uint256 amountIn) external updateReserves returns (uint256 amountOut) {
        require(tokenIn == address(token0) || tokenIn == address(token1), "Invalid token");

        bool isToken0 = tokenIn == address(token0);
        IERC20 inputToken = isToken0 ? token0 : token1;
        IERC20 outputToken = isToken0 ? token1 : token0;
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;

        inputToken.transferFrom(msg.sender, address(this), amountIn);

        uint256 amountInWithFee = (amountIn * (1000 - FEE_PERCENTAGE)) / 1000;
        amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);

        outputToken.transfer(msg.sender, amountOut);

        emit Swapped(msg.sender, tokenIn, amountIn, amountOut);
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserve0, reserve1);
    }

    // Helper function to calculate square root
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    // Helper function to find the minimum of two values
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
