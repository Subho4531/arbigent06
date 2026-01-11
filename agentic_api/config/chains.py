"""Aptos Chain Configuration - APT, USDC, USDT Focus"""

# Aptos Mainnet Configuration
APTOS_CONFIG = {
    "chain_id": 1,
    "name": "Aptos Mainnet",
    "rpc_url": "https://fullnode.mainnet.aptoslabs.com/v1",
    "explorer_url": "https://explorer.aptoslabs.com",
    "native_token": "APT",
    "decimals": 8
}

# Supported Tokens on Aptos
APTOS_TOKENS = {
    "APT": {
        "symbol": "APT",
        "name": "Aptos",
        "address": "0x1::aptos_coin::AptosCoin",
        "decimals": 8,
        "is_native": True,
        "coingecko_id": "aptos"
    },
    "USDC": {
        "symbol": "USDC",
        "name": "USD Coin",
        "address": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
        "decimals": 6,
        "is_native": False,
        "coingecko_id": "usd-coin"
    },
    "USDT": {
        "symbol": "USDT", 
        "name": "Tether USD",
        "address": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
        "decimals": 6,
        "is_native": False,
        "coingecko_id": "tether"
    }
}

# Aptos DEX Configuration
APTOS_DEXS = {
    "pancakeswap": {
        "name": "PancakeSwap",
        "fee": 0.25,  # 0.25%
        "router_address": "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfb01482c54aa1b9c0e0dcb6",
        "factory_address": "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfb01482c54aa1b9c0e0dcb6",
        "supported_pairs": ["APT-USDC", "APT-USDT", "USDC-USDT"]
    },
    "liquidswap": {
        "name": "LiquidSwap",
        "fee": 0.30,  # 0.30%
        "router_address": "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
        "factory_address": "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12",
        "supported_pairs": ["APT-USDC", "APT-USDT", "USDC-USDT"]
    },
    "thalaswap": {
        "name": "ThalaSwap",
        "fee": 0.20,  # 0.20%
        "router_address": "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af",
        "factory_address": "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af",
        "supported_pairs": ["APT-USDC", "APT-USDT", "USDC-USDT"]
    }
}

# Trading Pairs Configuration
TRADING_PAIRS = {
    "APT-USDC": {
        "base": "APT",
        "quote": "USDC",
        "pair_address": "0x05a97986a9d031c4567e15b797be516910cfcb4156312482efc6a19c0a30c948",
        "available_dexs": ["pancakeswap", "liquidswap", "thalaswap"]
    },
    "APT-USDT": {
        "base": "APT", 
        "quote": "USDT",
        "pair_address": "0x61d2c22a6cb7831bee0f48363b0eec92369357aece0d1142062f7d5d85c7bef8",
        "available_dexs": ["pancakeswap", "liquidswap", "thalaswap"]
    },
    "USDC-USDT": {
        "base": "USDC",
        "quote": "USDT", 
        "pair_address": "0x89576037b3cc0b89645ea393a47787bb348272c76d6941c574b053672b848039",
        "available_dexs": ["pancakeswap", "liquidswap", "thalaswap"]
    }
}

# Gas Configuration for Aptos
GAS_CONFIG = {
    "max_gas_amount": 2000,
    "gas_unit_price": 100,  # in octas
    "gas_currency": "APT",
    "typical_swap_gas": 1000,
    "typical_add_liquidity_gas": 1500,
    "typical_remove_liquidity_gas": 1200
}

# API Endpoints
API_ENDPOINTS = {
    "price_feeds": {
        "coingecko": "https://api.coingecko.com/api/v3/simple/price",
        "binance": "https://api.binance.com/api/v3/ticker/24hr",
        "coinbase": "https://api.coinbase.com/v2/exchange-rates"
    },
    "aptos_rpc": {
        "mainnet": "https://fullnode.mainnet.aptoslabs.com/v1",
        "testnet": "https://fullnode.testnet.aptoslabs.com/v1",
        "devnet": "https://fullnode.devnet.aptoslabs.com/v1"
    },
    "defi_data": {
        "defillama": "https://api.llama.fi",
        "dexscreener": "https://api.dexscreener.com/latest/dex"
    }
}

# Arbitrage Configuration
ARBITRAGE_CONFIG = {
    "min_profit_threshold": 0.1,  # 0.1% minimum profit
    "max_slippage": 1.0,          # 1.0% max slippage
    "default_trade_amount": 1000,  # $1000 default
    "supported_routes": [
        "APT -> USDC -> APT",
        "APT -> USDT -> APT", 
        "USDC -> APT -> USDT",
        "USDT -> APT -> USDC"
    ]
}

# Export main configuration
CHAINS = {
    "aptos": APTOS_CONFIG
}

TOKENS = APTOS_TOKENS
DEXS = APTOS_DEXS

# Legacy compatibility
SUPPORTED_CHAINS = ["aptos"]
SUPPORTED_CURRENCIES = ["apt", "usdc", "usdt"]

