# Core vs. Periphery Contracts: Implementation Guide

This guide explains the key differences between interacting with the core contracts directly versus using periphery contracts in the p-dex ecosystem.

## Architecture Overview

Uniswap V3 (and p-dex as its fork) uses a two-layer architecture:

1. **Core contracts** - The minimal, non-upgradeable contracts that handle the essential protocol functions:
   - Factory for creating pools
   - Pool implementation with concentrated liquidity logic
   - Core math and shared libraries

2. **Periphery contracts** - Higher-level contracts that make the protocol easier to use:
   - SwapRouter for executing swaps
   - NonfungiblePositionManager for creating/managing LP positions
   - Helper contracts for common operations

## Key Differences

### 1. Pool Creation

**Core approach**: The Factory contract creates pools directly, and initialization happens through direct pool calls.
```typescript
// Using core contracts directly
const factory = await hre.ethers.getContractAt('UniswapV3Factory', factoryAddress);
const createTx = await factory.createPool(tokenA, tokenB, fee);
const pool = await hre.ethers.getContractAt('UniswapV3Pool', poolAddress);
await pool.initialize(initialSqrtPriceX96);
```

**Periphery approach**: Pool creation still happens through the core Factory contract. Periphery contracts don't handle pool creation.

### 2. Swapping

**Core approach**: Direct pool interaction requires:
- Pre-calculating exact inputs/outputs
- Managing token transfers
- Handling callbacks
- Implementing complex swap logic

```typescript
// Direct swap using core contracts (simplified)
const zeroForOne = true; // Swap token0 for token1
const amountIn = ethers.utils.parseEther('10');
await token0.transfer(pool.address, amountIn);

await pool.swap(
  recipient,
  zeroForOne,
  amountIn,
  sqrtPriceLimitX96,
  encodedCallbackData
);
```

**Periphery approach**: SwapRouter handles all complexity:
- Manages token transfers and approvals
- Processes multiple pool routes
- Handles exactInput/exactOutput logic

```typescript
// Using periphery SwapRouter (easier)
const swapRouter = await ethers.getContractAt('SwapRouter', routerAddress);
await token0.approve(swapRouter.address, amountIn);

await swapRouter.exactInputSingle({
  tokenIn: token0.address,
  tokenOut: token1.address,
  fee: poolFee,
  recipient: recipient,
  deadline: deadline,
  amountIn: amountIn,
  amountOutMinimum: amountOutMinimum,
  sqrtPriceLimitX96: 0
});
```

### 3. Adding Liquidity

**Core approach**: Direct interaction is complex:
- Calculate exact tick positions
- Determine liquidity amount
- Handle multiple token transfers
- Implement callbacks for minting

```typescript
// Direct liquidity adding (complex)
await token0.transfer(pool.address, amount0Desired);
await token1.transfer(pool.address, amount1Desired);

await pool.mint(
  recipient,
  lowerTick,
  upperTick,
  liquidityAmount,
  encodedCallbackData
);
```

**Periphery approach**: NonfungiblePositionManager simplifies the process:
- Creates NFT representing position
- Manages token approvals and transfers
- Calculates optimal amounts
- Handles position tracking

```typescript
// Using periphery (much easier)
const positionManager = await ethers.getContractAt('NonfungiblePositionManager', managerAddress);
await token0.approve(positionManager.address, amount0Desired);
await token1.approve(positionManager.address, amount1Desired);

await positionManager.mint({
  token0: token0.address,
  token1: token1.address,
  fee: poolFee,
  tickLower: tickLower,
  tickUpper: tickUpper,
  amount0Desired: amount0Desired,
  amount1Desired: amount1Desired,
  amount0Min: 0,
  amount1Min: 0,
  recipient: recipient,
  deadline: deadline
});
```

## When to Use Each Approach

### Use Core Contracts for:
- Creating pools
- Protocol development and testing
- Custom integrations requiring fine-grained control
- Minimal gas optimization for specific cases

### Use Periphery Contracts for:
- End-user applications
- Standard swaps and liquidity provision
- Position management via NFTs
- Multi-pool routes and complex swaps
- Frontend integrations

## Migrating from Core to Periphery

When moving from direct core contract calls to periphery:

1. Deploy the periphery contracts (SwapRouter, NonfungiblePositionManager)
2. Update your interaction code to use periphery interfaces instead of direct pool calls
3. Migrate any existing swap functionality to use the SwapRouter
4. For new liquidity positions, use the NonfungiblePositionManager

The scripts in this repository provide examples of how to properly use the periphery contracts for your p-dex implementation. 