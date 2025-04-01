const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log('Adding liquidity with the account:', deployer.address);

  // Load periphery deployment info
  const peripheryPath = path.join(__dirname, '../deployed-periphery.json');
  if (!fs.existsSync(peripheryPath)) {
    throw new Error('Periphery deployment info not found. Deploy position manager first.');
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
  const positionManagerAddress = peripheryDeployment.positionManager;
  const token0Address = poolDeployment.tokens.token0.address;
  const token1Address = poolDeployment.tokens.token1.address;
  const poolAddress = poolDeployment.pool.address;
  const poolFee = poolDeployment.pool.fee;

  console.log('Using factory at:', factoryAddress);
  console.log('Using NonfungiblePositionManager at:', positionManagerAddress);
  console.log('Using pool at:', poolAddress);
  console.log('Pool fee tier:', poolFee);
  console.log('Token0:', token0Address);
  console.log('Token1:', token1Address);

  // Get contract instances
  const positionManager = await ethers.getContractAt('NonfungiblePositionManager', positionManagerAddress);
  const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress);

  // Check if the token addresses match the pool's tokens
  const poolToken0 = await pool.token0();
  const poolToken1 = await pool.token1();
  console.log('Pool token0:', poolToken0);
  console.log('Pool token1:', poolToken1);
  
  const token0 = await ethers.getContractAt('ERC20', poolToken0);
  const token1 = await ethers.getContractAt('ERC20', poolToken1);
  
  if (poolToken0.toLowerCase() !== token0Address.toLowerCase() || 
      poolToken1.toLowerCase() !== token1Address.toLowerCase()) {
    console.warn('Token order mismatch between pool and config!');
    console.warn(`Config: token0=${token0Address}, token1=${token1Address}`);
    console.warn(`Pool: token0=${poolToken0}, token1=${poolToken1}`);
    console.warn('Using the pool token order instead of config token order.');
  }

  // Check token balances
  const token0Balance = await token0.balanceOf(deployer.address);
  const token1Balance = await token1.balanceOf(deployer.address);
  
  console.log(`Token0 balance: ${ethers.utils.formatUnits(token0Balance, 18)}`);
  console.log(`Token1 balance: ${ethers.utils.formatUnits(token1Balance, 18)}`);

  // Get pool info
  const tickSpacing = await pool.tickSpacing();
  const slot0 = await pool.slot0();
  const currentTick = slot0.tick;
  const sqrtPriceX96 = slot0.sqrtPriceX96;
  
  console.log(`Pool tick spacing: ${tickSpacing}`);
  console.log(`Current tick: ${currentTick}`);
  console.log(`Current sqrtPriceX96: ${sqrtPriceX96}`);
  
  // Calculate current price from sqrtPriceX96
  const priceRatio = (Number(sqrtPriceX96) / 2**96) ** 2;
  console.log(`Current price ratio (token1/token0): ${priceRatio}`);
  
  // Use very small amount and correct ratio
  const baseAmount = ethers.utils.parseUnits('0.01', 18);  // 0.01 token
  const amount0ToMint = baseAmount;
  const amount1ToMint = baseAmount.mul(Math.floor(priceRatio * 10000)).div(10000);  // Adjusted for price
  
  console.log(`Using amounts: ${ethers.utils.formatUnits(amount0ToMint, 18)} token0, ${ethers.utils.formatUnits(amount1ToMint, 18)} token1`);
  
  // Create a much narrower range around current tick
  // Just use the current tick for now
  let minTick = Math.floor(currentTick / tickSpacing) * tickSpacing;
  let maxTick = Math.floor(currentTick / tickSpacing) * tickSpacing + tickSpacing;
  
  console.log(`Using very narrow tick range: ${minTick} to ${maxTick}`);
  
  // Get actual fee from pool
  const poolActualFee = await pool.fee();
  console.log(`Pool fee from JSON: ${poolFee}`);
  console.log(`Actual pool fee: ${poolActualFee}`);
  
  // Check if we have enough balance for tokens
  if (token0Balance.lt(amount0ToMint)) {
    throw new Error(`Insufficient token0 balance. Have ${ethers.utils.formatUnits(token0Balance, 18)}, need ${ethers.utils.formatUnits(amount0ToMint, 18)}`);
  }
  
  if (token1Balance.lt(amount1ToMint)) {
    throw new Error(`Insufficient token1 balance. Have ${ethers.utils.formatUnits(token1Balance, 18)}, need ${ethers.utils.formatUnits(amount1ToMint, 18)}`);
  }

  // Add liquidity
  console.log('Adding liquidity...');
  const mintParams = {
    token0: poolToken0,  // Use the actual pool tokens, not from config
    token1: poolToken1, 
    fee: poolActualFee, // Get fee directly from pool
    tickLower: minTick,
    tickUpper: maxTick,
    amount0Desired: amount0ToMint,
    amount1Desired: amount1ToMint,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
  };

  console.log('Mint params:', mintParams);
  
  try {
    // Check if the pool has liquidity already
    try {
      console.log('Checking if pool already has liquidity...');
      const liquidity = await pool.liquidity();
      console.log(`Pool liquidity: ${liquidity.toString()}`);
      
      if (liquidity.toString() === '0') {
        console.log('Pool has no liquidity yet. This might be the initial liquidity provision.');
      } else {
        console.log('Pool already has liquidity.');
      }
    } catch (err) {
      console.log('Error checking pool liquidity:', err.message);
    }
    
    // Use standard ticks that work in Uniswap V3
    // These are commonly used in 0.3% fee tier pools
    minTick = -887220;  // MIN_TICK for 0.3% pool
    maxTick = 887220;   // MAX_TICK for 0.3% pool
    
    // Set token amounts
    // When adding initial liquidity, using a 1:1 ratio is often needed
    const amount0ToMint = ethers.utils.parseUnits('0.1', 18);
    const amount1ToMint = ethers.utils.parseUnits('0.1', 18);
    
    console.log(`Using full-range tick bounds: ${minTick} to ${maxTick}`);
    console.log(`Using equal amounts: ${ethers.utils.formatUnits(amount0ToMint, 18)} token0, ${ethers.utils.formatUnits(amount1ToMint, 18)} token1`);
    
    // Update mint params with full range
    const mintParams = {
      token0: poolToken0,
      token1: poolToken1,
      fee: poolActualFee,
      tickLower: minTick,
      tickUpper: maxTick,
      amount0Desired: amount0ToMint,
      amount1Desired: amount1ToMint,
      amount0Min: 0,
      amount1Min: 0,
      recipient: deployer.address,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20
    };
    
    console.log('New mint params:', mintParams);
    
    // Get current gas price
    const gasPrice = await ethers.provider.getGasPrice();
    console.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
    
    // Use legacy transaction type with explicit gas price
    const approveOptions = {
      gasPrice: gasPrice.mul(12).div(10), // Add 20% to current gas price
      gasLimit: 100000 // Set a reasonable gas limit for approvals
    };
    
    // Approve tokens with explicit gas options
    await token0.approve(positionManagerAddress, amount0ToMint, approveOptions);
    await token1.approve(positionManagerAddress, amount1ToMint, approveOptions);
    console.log('Tokens approved');
    
    // Set transaction options with explicit gas price for mint
    const mintOptions = {
      gasPrice: gasPrice.mul(12).div(10), // Add 20% to current gas price
      gasLimit: 1000000 // Set a higher gas limit for minting position
    };
    
    console.log('Sending mint transaction with higher gas limit...');
    const tx = await positionManager.mint(mintParams, mintOptions);
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    
    // Find the token ID from the event
    for (const event of receipt.events) {
      if (event.event === 'IncreaseLiquidity') {
        const tokenId = event.args.tokenId;
        const liquidity = event.args.liquidity;
        const amount0 = event.args.amount0;
        const amount1 = event.args.amount1;
        
        console.log(`Successfully added liquidity!`);
        console.log(`- Token ID: ${tokenId}`);
        console.log(`- Liquidity: ${liquidity}`);
        console.log(`- Amount0: ${ethers.utils.formatUnits(amount0, 18)}`);
        console.log(`- Amount1: ${ethers.utils.formatUnits(amount1, 18)}`);
        
        // Save position info
        const positions = fs.existsSync('../deployed-positions.json') 
          ? JSON.parse(fs.readFileSync('../deployed-positions.json', 'utf8')) 
          : { positions: [] };
          
        positions.positions.push({
          tokenId: tokenId.toString(),
          token0: token0Address,
          token1: token1Address,
          fee: poolFee,
          tickLower: minTick,
          tickUpper: maxTick,
          liquidity: liquidity.toString(),
          amount0: amount0.toString(),
          amount1: amount1.toString()
        });
        
        fs.writeFileSync(
          '../deployed-positions.json',
          JSON.stringify(positions, null, 2)
        );
        
        console.log('Position information saved to deployed-positions.json');
        break;
      }
    }
  } catch (error) {
    console.error('Error adding liquidity:', error);
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