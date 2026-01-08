# Arbigent Backend

MongoDB-powered vault management system for the Arbigent DeFi platform.

## Features

- **User Management**: Wallet-based user profiles and preferences
- **Vault System**: Multi-coin vault balances with burn/mint logic
- **Transaction Logging**: Comprehensive transaction history and analytics
- **Agent Activity**: AI agent decision logging and performance tracking
- **Smart Contract Integration**: Aptos blockchain integration with faucet

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and faucet private key
   ```

3. **Start MongoDB**
   - Local: `mongod --dbpath /path/to/data`
   - Or use MongoDB Atlas cloud service

4. **Seed Database**
   ```bash
   node scripts/seedCoins.js
   ```

5. **Start Server**
   ```bash
   npm start
   ```

## API Documentation

See [VAULT_API_ROUTES.md](../VAULT_API_ROUTES.md) for complete API documentation.

## Database Models

- **User**: Wallet-based user profiles
- **Vault**: Multi-coin vault balances and strategies
- **Coin**: Supported coins with burn/mint tracking
- **TransactionLog**: All vault transactions and smart contract interactions
- **AgenticLog**: AI agent activities and performance metrics

## Environment Variables

```env
FAUCET_PRIVATE_KEY=your-aptos-private-key
PORT=3001
MONGODB_URI=mongodb://localhost:27017/arbigent
JWT_SECRET=your-jwt-secret
API_BASE_URL=http://localhost:3001
```

## Architecture

The system implements a vault-based architecture where:
1. Users deposit tokens → Smart contract burns tokens → Vault balance increases
2. Users withdraw tokens → Vault balance decreases → Smart contract mints tokens
3. All operations are logged for transparency and analytics
4. AI agents can interact with the system and log their activities

## Original Faucet Setup (Legacy)

The backend also includes the original faucet functionality:

1. **Get testnet account private key:**
```bash
cd ../move
aptos init --profile testnet --network testnet
```

2. **Fund the faucet account:**
Visit https://aptos.dev/network/faucet and paste your account address to get testnet APT.

3. **Get your private key:**
```bash
# On Windows
type %USERPROFILE%\.aptos\config.yaml

# On Mac/Linux
cat ~/.aptos/config.yaml
```

Look for the `private_key` under the `testnet` profile and add it to your `.env` file.
