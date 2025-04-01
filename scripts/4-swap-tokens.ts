const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log('Swapping tokens with the account:', deployer.address);

  // Load periphery deployment info
  const peripheryPath = path.join(__dirname, '../deployed-periphery.json');
  if (!fs.existsSync(peripheryPath)) {
    throw new Error('Periphery deployment info not found. Deploy SwapRouter first.');
  }
  const peripheryDeployment = JSON.parse(fs.readFileSync(peripheryPath, 'utf8'));
  
  // Load pool deployment info
  const poolPath = path.join(__dirname, '../../p-Dex/deployed-pool.json');
  if (!fs.existsSync(poolPath)) {
    throw new Error('Pool deployment info not found. Create a pool first.');
  }
  const poolDeployment = JSON.parse(fs.readFileSync(poolPath, 'utf8'));

  // Get contracts and addresses
  const factoryAddress = peripheryDeployment.factory;
  const swapRouterAddress = peripheryDeployment.swapRouter;
  const token0Address = poolDeployment.tokens.token0.address;
  const token1Address = poolDeployment.tokens.token1.address;
  const poolAddress = poolDeployment.pool.address;
  const poolFee = poolDeployment.pool.fee;

  console.log('Using factory at:', factoryAddress);
  console.log('Using SwapRouter at:', swapRouterAddress);
  console.log('Using pool at:', poolAddress);
  console.log('Pool fee tier:', poolFee);
  console.log('Token0:', token0Address);
  console.log('Token1:', token1Address);

  // Get contract instances
  const swapRouter = await ethers.getContractAt('SwapRouter', swapRouterAddress);
  
  // Get the pool to check token order
  const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress);
  const poolToken0 = await pool.token0();
  const poolToken1 = await pool.token1();
  
  console.log('Pool token0:', poolToken0);
  console.log('Pool token1:', poolToken1);
  
  if (poolToken0.toLowerCase() !== token0Address.toLowerCase() || 
      poolToken1.toLowerCase() !== token1Address.toLowerCase()) {
    console.warn('Token order mismatch between pool and config!');
    console.warn(`Config: token0=${token0Address}, token1=${token1Address}`);
    console.warn(`Pool: token0=${poolToken0}, token1=${poolToken1}`);
    console.warn('Using the pool token order instead of config token order.');
  }
  
  // Check pool liquidity
  try {
    const liquidity = await pool.liquidity();
    console.log(`Pool current liquidity: ${liquidity.toString()}`);
    if (liquidity.toString() === '0') {
      console.error('Pool has no liquidity! Please add liquidity before swapping.');
      process.exit(1);
    }
  } catch (err) {
    console.warn('Error checking pool liquidity:', err.message);
  }
  
  // Get slot0 to check the current price
  try {
    const slot0 = await pool.slot0();
    console.log(`Current tick: ${slot0.tick}`);
    console.log(`Current sqrtPriceX96: ${slot0.sqrtPriceX96}`);
  } catch (err) {
    console.warn('Error checking slot0:', err.message);
  }
  
  // Use pool's actual token order
  const token0 = await ethers.getContractAt('ERC20', poolToken0);
  const token1 = await ethers.getContractAt('ERC20', poolToken1);

  // Check token balances before swap
  const token0BalanceBefore = await token0.balanceOf(deployer.address);
  const token1BalanceBefore = await token1.balanceOf(deployer.address);
  
  console.log(`Token0 balance before swap: ${ethers.utils.formatUnits(token0BalanceBefore, 18)}`);
  console.log(`Token1 balance before swap: ${ethers.utils.formatUnits(token1BalanceBefore, 18)}`);

  // Amount to swap - reduce the amount for testing
  const amountIn = ethers.utils.parseUnits('0.01', 18); // Small amount for initial test
  
  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();
  console.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
  
  // Set up gas options
  const gasOptions = {
    gasPrice: gasPrice.mul(12).div(10), // Add 20% to current gas price
    gasLimit: 500000 // Higher gas limit for swap
  };

  // Approve token0 to SwapRouter
  console.log('Approving token0 to SwapRouter...');
  await token0.approve(swapRouterAddress, amountIn);
  console.log('Token0 approved');

  // Create parameters for exactInputSingle
  const params = {
    tokenIn: poolToken0,  // Use pool's token ordering
    tokenOut: poolToken1,
    fee: poolFee,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
    amountIn: amountIn,
    amountOutMinimum: 0, // In production, you should use a real slippage calculation
    sqrtPriceLimitX96: 0 // No price limit
  };

  console.log('Swap params:', params);

  try {
    // Execute the swap
    console.log('Executing swap...');
    const tx = await swapRouter.exactInputSingle(params, gasOptions);
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`Swap transaction confirmed in block ${receipt.blockNumber}`);
    
    // Check token balances after swap
    const token0BalanceAfter = await token0.balanceOf(deployer.address);
    const token1BalanceAfter = await token1.balanceOf(deployer.address);
    
    console.log(`Token0 balance after swap: ${ethers.utils.formatUnits(token0BalanceAfter, 18)}`);
    console.log(`Token1 balance after swap: ${ethers.utils.formatUnits(token1BalanceAfter, 18)}`);
    
    // Calculate and display changes
    const token0Change = token0BalanceBefore.sub(token0BalanceAfter);
    const token1Change = token1BalanceAfter.sub(token1BalanceBefore);
    
    console.log(`Token0 spent: ${ethers.utils.formatUnits(token0Change, 18)}`);
    console.log(`Token1 received: ${ethers.utils.formatUnits(token1Change, 18)}`);
    console.log(`Effective price: ${token0Change.mul(ethers.utils.parseUnits('1', 18)).div(token1Change)} token0/token1`);
    
    console.log('Swap completed successfully!');
  } catch (error) {
    console.error('Error executing swap:', error);
    console.error('Error message:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }

  // Now let's demonstrate swapping in the other direction (token1 -> token0)
  console.log('\n=== Swapping token1 for token0 ===');
  
  // Approve token1 to SwapRouter
  console.log('Approving token1 to SwapRouter...');
  await token1.approve(swapRouterAddress, amountIn, gasOptions);
  console.log('Token1 approved');

  // Create parameters for the reverse swap
  const reverseParams = {
    tokenIn: poolToken1,  // Use pool's token ordering
    tokenOut: poolToken0,
    fee: poolFee,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  };

  console.log('Reverse swap params:', reverseParams);

  try {
    console.log('Executing reverse swap...');
    const tx = await swapRouter.exactInputSingle(reverseParams, gasOptions);
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`Reverse swap transaction confirmed in block ${receipt.blockNumber}`);
    
    // Check token balances after reverse swap
    const token0BalanceAfterReverse = await token0.balanceOf(deployer.address);
    const token1BalanceAfterReverse = await token1.balanceOf(deployer.address);
    
    console.log(`Token0 balance after reverse swap: ${ethers.utils.formatUnits(token0BalanceAfterReverse, 18)}`);
    console.log(`Token1 balance after reverse swap: ${ethers.utils.formatUnits(token1BalanceAfterReverse, 18)}`);
    
    console.log('Reverse swap completed successfully!');
  } catch (error) {
    console.error('Error executing reverse swap:', error);
    console.error('Error message:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Add empty export to make this file a module
export {}; 