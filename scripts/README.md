# p-dex-periphery Deployment and Interaction Scripts

This directory contains scripts for deploying and interacting with the p-dex periphery contracts (Uniswap V3 fork) on the Pharos (devnet) chain.

## Relationship with Core Contracts

The p-dex project follows Uniswap V3's architecture with two main repositories:

1. **p-Dex (Core)** - Contains the core contracts and logic:
   - Factory contract that creates pools
   - Pool implementation with CLMM logic
   - Basic token contracts for testing

2. **p-dex-periphery (This repo)** - Contains peripheral contracts for easier interaction:
   - SwapRouter for executing swaps
   - NonfungiblePositionManager for LP positions
   - Helper contracts and libraries

**Important**: Pool creation and initialization must happen through the core contracts. The periphery contracts only interact with already created pools.

## Prerequisites

Before running these scripts, ensure you have:

1. Deployed the p-dex core contracts using the scripts in the p-Dex repository
2. Set up your environment variables in `.env` file
3. Configured the correct network in hardhat.config.ts

## Deployment Process

### 1. Deploy SwapRouter

```bash
npx hardhat run scripts/1-deploy-swap-router.ts --network devnet
```

This script:
- Uses the factory address from the core p-Dex deployment
- Deploys or reuses a WETH9 token
- Deploys the SwapRouter contract
- Saves deployment information to `deployed-periphery.json`

### 2. Deploy Position Manager

```bash
npx hardhat run scripts/2-deploy-position-manager.ts --network devnet
```

This script:
- Uses the factory and WETH9 addresses from previous deployments
- Deploys the NonfungibleTokenPositionDescriptor contract
- Deploys the NonfungiblePositionManager contract
- Updates deployment information in `deployed-periphery.json`

## Interaction Scripts

### 3. Add Liquidity

```bash
npx hardhat run scripts/3-add-liquidity.ts --network devnet
```

This script:
- Uses the NonfungiblePositionManager to create a position in the pool
- Approves tokens to be used by the position manager
- Creates a new position with liquidity in a defined price range
- Saves position information to `deployed-positions.json`

### 4. Swap Tokens

```bash
npx hardhat run scripts/4-swap-tokens.ts --network devnet
```

This script:
- Uses the SwapRouter to swap token0 for token1
- Approves tokens to be used by the swap router
- Executes an exactInputSingle swap
- Shows balance changes and the effective price
- Also demonstrates a reverse swap (token1 for token0)

## Complete Deployment Flow

For a complete CLMM DEX deployment, follow these steps in order:

1. In the p-Dex repository:
   - Deploy the factory (`1-deploy-factory.ts`)
   - Deploy test tokens (`2-deploy-tokens.ts`)
   - Create a pool (`3-create-pool.ts`)
   - *(Optional)* Use `4-interact.ts` to check pool status and balances

2. In the p-dex-periphery repository:
   - Deploy the SwapRouter (`1-deploy-swap-router.ts`)
   - Deploy the NonfungiblePositionManager (`2-deploy-position-manager.ts`)
   - Add liquidity to a pool (`3-add-liquidity.ts`)
   - Perform token swaps (`4-swap-tokens.ts`)

**Note**: The `mint-and-swap.ts` script in the core repository overlaps with our periphery functionality. For production usage, prefer using the periphery contracts for all user interactions like swapping and liquidity provision.

## Troubleshooting

If you encounter issues:

1. Ensure that all the required contracts are deployed in the correct order
2. Verify that you have sufficient token balances for interactions
3. Check that the contract addresses in the JSON files are correct
4. Make sure you're using the correct network (devnet) 