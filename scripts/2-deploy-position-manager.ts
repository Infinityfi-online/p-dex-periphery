const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying NonfungiblePositionManager with the account:', deployer.address);

  // Load periphery deployment info
  const peripheryPath = path.join(__dirname, '../deployed-periphery.json');
  if (!fs.existsSync(peripheryPath)) {
    throw new Error('Periphery deployment info not found. Deploy SwapRouter first.');
  }

  const peripheryDeployment = JSON.parse(fs.readFileSync(peripheryPath, 'utf8'));
  const factoryAddress = peripheryDeployment.factory;
  const weth9Address = peripheryDeployment.weth9;
  
  console.log('Using factory at:', factoryAddress);
  console.log('Using WETH9 at:', weth9Address);

  // First, deploy NFTDescriptor library - this is required for the position descriptor
  console.log('Deploying NFTDescriptor library...');
  const NFTDescriptor = await hre.ethers.getContractFactory('NFTDescriptor');
  const nftDescriptor = await NFTDescriptor.deploy();
  await nftDescriptor.deployed();
  console.log('NFTDescriptor library deployed to:', nftDescriptor.address);

  // Create bytes32 representation of the native currency label (ETH)
  const nativeCurrencyLabelBytes = hre.ethers.utils.formatBytes32String('ETH');
  console.log('Native currency label:', 'ETH', 'as bytes32:', nativeCurrencyLabelBytes);

  // Next, deploy NonfungibleTokenPositionDescriptor with the library linked
  console.log('Deploying NonfungibleTokenPositionDescriptor...');
  const NonfungibleTokenPositionDescriptor = await hre.ethers.getContractFactory(
    'NonfungibleTokenPositionDescriptor',
    {
      libraries: {
        NFTDescriptor: nftDescriptor.address
      }
    }
  );
  const tokenDescriptor = await NonfungibleTokenPositionDescriptor.deploy(
    weth9Address,
    nativeCurrencyLabelBytes
  );
  await tokenDescriptor.deployed();
  console.log('NonfungibleTokenPositionDescriptor deployed to:', tokenDescriptor.address);

  // Deploy NonfungiblePositionManager
  console.log('Deploying NonfungiblePositionManager...');
  const NonfungiblePositionManager = await hre.ethers.getContractFactory('NonfungiblePositionManager');
  const positionManager = await NonfungiblePositionManager.deploy(
    factoryAddress,
    weth9Address,
    tokenDescriptor.address
  );
  await positionManager.deployed();
  console.log('NonfungiblePositionManager deployed to:', positionManager.address);
  
  // Update deployment info
  peripheryDeployment.nftDescriptor = nftDescriptor.address;
  peripheryDeployment.tokenDescriptor = tokenDescriptor.address;
  peripheryDeployment.positionManager = positionManager.address;
  
  fs.writeFileSync(
    peripheryPath,
    JSON.stringify(peripheryDeployment, null, 2)
  );
  
  console.log(`NonfungiblePositionManager deployment information saved to ${peripheryPath}`);
  console.log('NonfungiblePositionManager deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Add empty export to make this file a module
export {}; 