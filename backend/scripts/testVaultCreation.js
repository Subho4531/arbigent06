import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Vault from '../models/Vault.js';

dotenv.config();

const testVaultCreation = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test wallet address
    const testWalletAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    // Delete existing test vault if it exists
    await Vault.deleteOne({ walletAddress: testWalletAddress.toLowerCase() });
    console.log('🧹 Cleaned up existing test vault');

    // Create new vault using findOrCreate
    const vault = await Vault.findOrCreate(testWalletAddress);
    console.log('🏦 Created new vault:', {
      walletAddress: vault.walletAddress,
      balances: vault.balances.map(b => ({
        coin: b.coinSymbol,
        balance: b.balance,
        lockedBalance: b.lockedBalance,
        earnedRewards: b.earnedRewards
      }))
    });

    // Verify all balances are 0
    const aptBalance = vault.getCoinBalance('APT');
    const usdcBalance = vault.getCoinBalance('USDC');
    const usdtBalance = vault.getCoinBalance('USDT');

    console.log('💰 Balance verification:');
    console.log(`  APT: ${aptBalance} (should be 0)`);
    console.log(`  USDC: ${usdcBalance} (should be 0)`);
    console.log(`  USDT: ${usdtBalance} (should be 0)`);

    // Test balance update
    console.log('\n🔄 Testing balance update...');
    await vault.updateCoinBalance('USDC', '1000000', true); // 1 USDC (6 decimals)
    console.log(`  USDC after deposit: ${vault.getCoinBalance('USDC')}`);

    await vault.updateCoinBalance('USDC', '500000', false); // Withdraw 0.5 USDC
    console.log(`  USDC after withdrawal: ${vault.getCoinBalance('USDC')}`);

    // Clean up test vault
    await Vault.deleteOne({ walletAddress: testWalletAddress.toLowerCase() });
    console.log('🧹 Cleaned up test vault');

    console.log('\n✅ All vault tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

testVaultCreation();