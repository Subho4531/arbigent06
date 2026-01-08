#!/bin/bash

# Deploy Updated Smart Contract with Proper Token Burning
echo "🚀 Deploying updated smart contract with proper token burning..."

# Build the contract
echo "📦 Building contract..."
aptos move compile --named-addresses arbitrage=default

if [ $? -ne 0 ]; then
    echo "❌ Contract compilation failed!"
    exit 1
fi

# Deploy the contract
echo "🔄 Deploying contract..."
aptos move publish --named-addresses arbitrage=default --profile testnet

if [ $? -ne 0 ]; then
    echo "❌ Contract deployment failed!"
    exit 1
fi

echo "✅ Contract deployed successfully!"

# Initialize tokens
echo "🔧 Initializing USDC token..."
aptos move run --function-id default::swap::initialize_usdc --profile testnet

echo "🔧 Initializing USDT token..."
aptos move run --function-id default::swap::initialize_usdt --profile testnet

echo "✅ Smart contract deployment complete!"
echo ""
echo "📋 New Functions Available:"
echo "  - swap_apt_to_usdc (now burns APT properly)"
echo "  - swap_apt_to_usdt (now burns APT properly)"
echo "  - deposit_usdc_to_vault (burns USDC for vault balance)"
echo "  - deposit_usdt_to_vault (burns USDT for vault balance)"
echo "  - withdraw_usdc_from_vault (mints USDC from vault balance)"
echo "  - withdraw_usdt_from_vault (mints USDT from vault balance)"
echo ""
echo "🔄 Next Steps:"
echo "1. Update CONTRACT_ADDRESS in frontend if needed"
echo "2. Test APT deposits (should now reduce APT balance)"
echo "3. Test direct USDC/USDT deposits (should burn tokens)"
echo "4. Test withdrawals (should mint tokens back)"