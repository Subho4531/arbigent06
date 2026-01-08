@echo off
echo 🚀 Deploying updated smart contract with proper token burning...

REM Build the contract
echo 📦 Building contract...
aptos move compile --named-addresses arbitrage=default

if %errorlevel% neq 0 (
    echo ❌ Contract compilation failed!
    exit /b 1
)

REM Deploy the contract
echo 🔄 Deploying contract...
aptos move publish --named-addresses arbitrage=default --profile testnet

if %errorlevel% neq 0 (
    echo ❌ Contract deployment failed!
    exit /b 1
)

echo ✅ Contract deployed successfully!

REM Initialize tokens
echo 🔧 Initializing USDC token...
aptos move run --function-id default::swap::initialize_usdc --profile testnet

echo 🔧 Initializing USDT token...
aptos move run --function-id default::swap::initialize_usdt --profile testnet

echo ✅ Smart contract deployment complete!
echo.
echo 📋 New Functions Available:
echo   - swap_apt_to_usdc (now burns APT properly)
echo   - swap_apt_to_usdt (now burns APT properly)
echo   - deposit_usdc_to_vault (burns USDC for vault balance)
echo   - deposit_usdt_to_vault (burns USDT for vault balance)
echo   - withdraw_usdc_from_vault (mints USDC from vault balance)
echo   - withdraw_usdt_from_vault (mints USDT from vault balance)
echo.
echo 🔄 Next Steps:
echo 1. Update CONTRACT_ADDRESS in frontend if needed
echo 2. Test APT deposits (should now reduce APT balance)
echo 3. Test direct USDC/USDT deposits (should burn tokens)
echo 4. Test withdrawals (should mint tokens back)

pause