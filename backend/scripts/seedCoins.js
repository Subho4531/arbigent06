import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Coin from '../models/Coin.js';
import connectDB from '../config/database.js';

dotenv.config();

const seedCoins = async () => {
  try {
    await connectDB();
    
    // Clear existing coins
    await Coin.deleteMany({});
    
    const coins = [
      {
        symbol: 'APT',
        name: 'Aptos',
        contractAddress: '0x1::aptos_coin::AptosCoin',
        coinType: '0x1::aptos_coin::AptosCoin',
        decimals: 8,
        totalSupply: '1000000000000000000', // 10B APT
        circulatingSupply: '500000000000000000', // 5B APT
        isNative: true,
        metadata: {
          description: 'Native token of the Aptos blockchain',
          website: 'https://aptoslabs.com',
          logoUrl: 'https://aptos.dev/img/aptos_logo.svg'
        },
        vaultConfig: {
          isVaultEnabled: true,
          minDepositAmount: '100000000', // 1 APT
          maxDepositAmount: '10000000000000000', // 100M APT
          depositFee: 0.1,
          withdrawalFee: 0.1
        }
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9',
        coinType: '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9::swap::USDC',
        decimals: 6,
        totalSupply: '50000000000000', // 50B USDC
        circulatingSupply: '30000000000000', // 30B USDC
        metadata: {
          description: 'USD Coin on Aptos (Smart Contract)',
          website: 'https://www.centre.io',
          logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
        },
        vaultConfig: {
          isVaultEnabled: true,
          minDepositAmount: '1000000', // 1 USDC
          maxDepositAmount: '100000000000000', // 100M USDC
          depositFee: 0.05,
          withdrawalFee: 0.05
        }
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        contractAddress: '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9',
        coinType: '0x851c087b280c6853667631d72147716d15276a7383608257ca9736eb01cd6af9::swap::USDT',
        decimals: 6,
        totalSupply: '80000000000000', // 80B USDT
        circulatingSupply: '70000000000000', // 70B USDT
        metadata: {
          description: 'Tether USD on Aptos (Smart Contract)',
          website: 'https://tether.to',
          logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
        },
        vaultConfig: {
          isVaultEnabled: true,
          minDepositAmount: '1000000', // 1 USDT
          maxDepositAmount: '100000000000000', // 100M USDT
          depositFee: 0.05,
          withdrawalFee: 0.05
        }
      }
    ];
    
    await Coin.insertMany(coins);
    
    console.log('✅ Coins seeded successfully');
    console.log(`📊 Inserted ${coins.length} coins`);
    
    // Display seeded coins
    const seededCoins = await Coin.find({}).sort({ symbol: 1 });
    console.log('\n📋 Seeded Coins:');
    seededCoins.forEach(coin => {
      console.log(`  ${coin.symbol} (${coin.name}) - Vault: ${coin.vaultConfig.isVaultEnabled ? '✅' : '❌'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding coins:', error);
    process.exit(1);
  }
};

seedCoins();