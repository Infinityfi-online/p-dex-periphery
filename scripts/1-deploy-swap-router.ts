const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying SwapRouter with the account:', deployer.address);

  // Read factory address from core project
  const factoryPath = path.join(__dirname, '../../p-Dex/deployed-factory.json');
  if (!fs.existsSync(factoryPath)) {
    throw new Error('Factory deployment info not found. Deploy the factory first.');
  }

  const factoryDeployment = JSON.parse(fs.readFileSync(factoryPath, 'utf8'));
  const factoryAddress = factoryDeployment.factory;
  console.log('Using factory at:', factoryAddress);

  // Load WETH9 address
  let weth9Address;
  const weth9Path = path.join(__dirname, '../../p-Dex/weth9-address.json');
  if (fs.existsSync(weth9Path)) {
    const weth9Data = JSON.parse(fs.readFileSync(weth9Path, 'utf8'));
    weth9Address = weth9Data.weth9;
    console.log('Using existing WETH9 at:', weth9Address);
  } else {
    // Deploy a new WETH9 contract
    console.log('Deploying WETH9...');
    const WETH9 = await hre.ethers.getContractFactory('WETH9');
    const weth9 = await WETH9.deploy();
    await weth9.deployed();
    weth9Address = weth9.address;
    console.log('WETH9 deployed to:', weth9Address);

    // Save WETH9 address
    fs.writeFileSync(
      weth9Path,
      JSON.stringify({ weth9: weth9Address }, null, 2)
    );
  }

  // Deploy SwapRouter
  console.log('Deploying SwapRouter...');
  const SwapRouter = await hre.ethers.getContractFactory('SwapRouter');
  const swapRouter = await SwapRouter.deploy(factoryAddress, weth9Address);
  await swapRouter.deployed();
  console.log('SwapRouter deployed to:', swapRouter.address);
  
  // Save deployment info
  const deploymentInfo = {
    networkName: hre.network.name,
    factory: factoryAddress,
    weth9: weth9Address,
    swapRouter: swapRouter.address
  };
  
  const deploymentPath = path.join(__dirname, '../deployed-periphery.json');
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`SwapRouter deployment information saved to ${deploymentPath}`);
  console.log('SwapRouter deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Add empty export to make this file a module
export {}; 