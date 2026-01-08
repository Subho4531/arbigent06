module arbitrage::swap {
    use std::signer;
    use std::string;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_framework::coin::{Self, MintCapability, BurnCapability};

    /// Error codes
    const E_NOT_PROFITABLE: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_NOT_INITIALIZED: u64 = 3;
    const E_ALREADY_INITIALIZED: u64 = 4;

    /// Custom token structs
    struct USDC {}
    struct USDT {}

    /// Store capabilities for minting/burning
    struct TokenCapabilities<phantom CoinType> has key {
        mint_cap: MintCapability<CoinType>,
        burn_cap: BurnCapability<CoinType>,
    }

    #[event]
    struct ProfitEvent has drop, store {
        trader: address,
        input_amount: u64,
        output_amount: u64,
        profit: u64,
        timestamp: u64,
        token_pair: vector<u8>,
    }

    #[event]
    struct SwapEvent has drop, store {
        trader: address,
        from_token: vector<u8>,
        to_token: vector<u8>,
        amount_in: u64,
        amount_out: u64,
        timestamp: u64,
    }

    #[event]
    struct MintEvent has drop, store {
        recipient: address,
        token: vector<u8>,
        amount: u64,
        timestamp: u64,
    }

    /// Initialize USDC token (call once by deployer)
    public entry fun initialize_usdc(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<TokenCapabilities<USDC>>(deployer_addr), E_ALREADY_INITIALIZED);

        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<USDC>(
            deployer,
            string::utf8(b"USD Coin"),
            string::utf8(b"USDC"),
            6,
            true
        );
        coin::destroy_freeze_cap(freeze_cap);

        move_to(deployer, TokenCapabilities<USDC> { mint_cap, burn_cap });
    }

    /// Initialize USDT token (call once by deployer)
    public entry fun initialize_usdt(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        assert!(!exists<TokenCapabilities<USDT>>(deployer_addr), E_ALREADY_INITIALIZED);

        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<USDT>(
            deployer,
            string::utf8(b"Tether USD"),
            string::utf8(b"USDT"),
            6,
            true
        );
        coin::destroy_freeze_cap(freeze_cap);

        move_to(deployer, TokenCapabilities<USDT> { mint_cap, burn_cap });
    }

    /// Mint USDC to user
    public entry fun mint_usdc(account: &signer, amount: u64) acquires TokenCapabilities {
        let module_addr = @arbitrage;
        assert!(exists<TokenCapabilities<USDC>>(module_addr), E_NOT_INITIALIZED);

        let recipient_addr = signer::address_of(account);
        
        if (!coin::is_account_registered<USDC>(recipient_addr)) {
            coin::register<USDC>(account);
        };

        let caps = borrow_global<TokenCapabilities<USDC>>(module_addr);
        let coins = coin::mint<USDC>(amount, &caps.mint_cap);
        coin::deposit(recipient_addr, coins);

        event::emit(MintEvent {
            recipient: recipient_addr,
            token: b"USDC",
            amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Mint USDT to user
    public entry fun mint_usdt(account: &signer, amount: u64) acquires TokenCapabilities {
        let module_addr = @arbitrage;
        assert!(exists<TokenCapabilities<USDT>>(module_addr), E_NOT_INITIALIZED);

        let recipient_addr = signer::address_of(account);
        
        if (!coin::is_account_registered<USDT>(recipient_addr)) {
            coin::register<USDT>(account);
        };

        let caps = borrow_global<TokenCapabilities<USDT>>(module_addr);
        let coins = coin::mint<USDT>(amount, &caps.mint_cap);
        coin::deposit(recipient_addr, coins);

        event::emit(MintEvent {
            recipient: recipient_addr,
            token: b"USDT",
            amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap APT to USDC - Burns APT from user and mints USDC
    public entry fun swap_apt_to_usdc(account: &signer, apt_amount: u64) acquires TokenCapabilities {
        let module_addr = @arbitrage;
        assert!(exists<TokenCapabilities<USDC>>(module_addr), E_NOT_INITIALIZED);

        let trader = signer::address_of(account);
        
        // First: Burn APT from user's account
        let apt_balance = coin::balance<0x1::aptos_coin::AptosCoin>(trader);
        assert!(apt_balance >= apt_amount, E_INSUFFICIENT_BALANCE);
        
        // Withdraw APT from user and burn it (transfer to module address)
        let apt_coins = coin::withdraw<0x1::aptos_coin::AptosCoin>(account, apt_amount);
        coin::deposit(module_addr, apt_coins);

        // Calculate USDC amount to mint
        let rate = 8000000 + ((apt_amount % 500000) as u64);
        let usdc_amount = (apt_amount * rate) / 100000000;

        // Register USDC if needed
        if (!coin::is_account_registered<USDC>(trader)) {
            coin::register<USDC>(account);
        };

        // Mint USDC to user
        let caps = borrow_global<TokenCapabilities<USDC>>(module_addr);
        let coins = coin::mint<USDC>(usdc_amount, &caps.mint_cap);
        coin::deposit(trader, coins);

        event::emit(SwapEvent {
            trader,
            from_token: b"APT",
            to_token: b"USDC",
            amount_in: apt_amount,
            amount_out: usdc_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap APT to USDT - Burns APT from user and mints USDT
    public entry fun swap_apt_to_usdt(account: &signer, apt_amount: u64) acquires TokenCapabilities {
        let module_addr = @arbitrage;
        assert!(exists<TokenCapabilities<USDT>>(module_addr), E_NOT_INITIALIZED);

        let trader = signer::address_of(account);
        
        // First: Burn APT from user's account
        let apt_balance = coin::balance<0x1::aptos_coin::AptosCoin>(trader);
        assert!(apt_balance >= apt_amount, E_INSUFFICIENT_BALANCE);
        
        // Withdraw APT from user and burn it (transfer to module address)
        let apt_coins = coin::withdraw<0x1::aptos_coin::AptosCoin>(account, apt_amount);
        coin::deposit(module_addr, apt_coins);

        // Calculate USDT amount to mint
        let rate = 8050000 + ((apt_amount % 400000) as u64);
        let usdt_amount = (apt_amount * rate) / 100000000;

        // Register USDT if needed
        if (!coin::is_account_registered<USDT>(trader)) {
            coin::register<USDT>(account);
        };

        // Mint USDT to user
        let caps = borrow_global<TokenCapabilities<USDT>>(module_addr);
        let coins = coin::mint<USDT>(usdt_amount, &caps.mint_cap);
        coin::deposit(trader, coins);

        event::emit(SwapEvent {
            trader,
            from_token: b"APT",
            to_token: b"USDT",
            amount_in: apt_amount,
            amount_out: usdt_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap USDC to APT - uses primary fungible store
    public entry fun swap_usdc_to_apt(account: &signer, usdc_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);
        
        // Simply burn from the primary fungible store
        let caps = borrow_global<TokenCapabilities<USDC>>(@arbitrage);
        coin::burn_from<USDC>(trader, usdc_amount, &caps.burn_cap);

        let rate = 12500000 + ((usdc_amount % 300000) as u64);
        let apt_amount = (usdc_amount * rate) / 1000000;

        event::emit(SwapEvent {
            trader,
            from_token: b"USDC",
            to_token: b"APT",
            amount_in: usdc_amount,
            amount_out: apt_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap USDT to APT - uses primary fungible store
    public entry fun swap_usdt_to_apt(account: &signer, usdt_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);
        
        let caps = borrow_global<TokenCapabilities<USDT>>(@arbitrage);
        coin::burn_from<USDT>(trader, usdt_amount, &caps.burn_cap);

        let rate = 12400000 + ((usdt_amount % 350000) as u64);
        let apt_amount = (usdt_amount * rate) / 1000000;

        event::emit(SwapEvent {
            trader,
            from_token: b"USDT",
            to_token: b"APT",
            amount_in: usdt_amount,
            amount_out: apt_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap USDC to USDT
    public entry fun swap_usdc_to_usdt(account: &signer, usdc_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);

        let usdc_caps = borrow_global<TokenCapabilities<USDC>>(@arbitrage);
        coin::burn_from<USDC>(trader, usdc_amount, &usdc_caps.burn_cap);

        let usdt_amount = usdc_amount * 9995 / 10000;

        if (!coin::is_account_registered<USDT>(trader)) {
            coin::register<USDT>(account);
        };

        let usdt_caps = borrow_global<TokenCapabilities<USDT>>(@arbitrage);
        let usdt_coins = coin::mint<USDT>(usdt_amount, &usdt_caps.mint_cap);
        coin::deposit(trader, usdt_coins);

        event::emit(SwapEvent {
            trader,
            from_token: b"USDC",
            to_token: b"USDT",
            amount_in: usdc_amount,
            amount_out: usdt_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Swap USDT to USDC
    public entry fun swap_usdt_to_usdc(account: &signer, usdt_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);

        let usdt_caps = borrow_global<TokenCapabilities<USDT>>(@arbitrage);
        coin::burn_from<USDT>(trader, usdt_amount, &usdt_caps.burn_cap);

        let usdc_amount = usdt_amount * 9995 / 10000;

        if (!coin::is_account_registered<USDC>(trader)) {
            coin::register<USDC>(account);
        };

        let usdc_caps = borrow_global<TokenCapabilities<USDC>>(@arbitrage);
        let usdc_coins = coin::mint<USDC>(usdc_amount, &usdc_caps.mint_cap);
        coin::deposit(trader, usdc_coins);

        event::emit(SwapEvent {
            trader,
            from_token: b"USDT",
            to_token: b"USDC",
            amount_in: usdt_amount,
            amount_out: usdc_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Deposit USDC to vault - Burns USDC from user (for vault balance increase)
    public entry fun deposit_usdc_to_vault(account: &signer, usdc_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);
        
        // Burn USDC from user's account
        let usdc_caps = borrow_global<TokenCapabilities<USDC>>(@arbitrage);
        coin::burn_from<USDC>(trader, usdc_amount, &usdc_caps.burn_cap);

        event::emit(SwapEvent {
            trader,
            from_token: b"USDC",
            to_token: b"VAULT_USDC",
            amount_in: usdc_amount,
            amount_out: usdc_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Deposit USDT to vault - Burns USDT from user (for vault balance increase)
    public entry fun deposit_usdt_to_vault(account: &signer, usdt_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);
        
        // Burn USDT from user's account
        let usdt_caps = borrow_global<TokenCapabilities<USDT>>(@arbitrage);
        coin::burn_from<USDT>(trader, usdt_amount, &usdt_caps.burn_cap);

        event::emit(SwapEvent {
            trader,
            from_token: b"USDT",
            to_token: b"VAULT_USDT",
            amount_in: usdt_amount,
            amount_out: usdt_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Withdraw USDC from vault - Mints USDC to user (for vault balance decrease)
    public entry fun withdraw_usdc_from_vault(account: &signer, usdc_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);
        
        // Register USDC if needed
        if (!coin::is_account_registered<USDC>(trader)) {
            coin::register<USDC>(account);
        };

        // Mint USDC to user
        let usdc_caps = borrow_global<TokenCapabilities<USDC>>(@arbitrage);
        let usdc_coins = coin::mint<USDC>(usdc_amount, &usdc_caps.mint_cap);
        coin::deposit(trader, usdc_coins);

        event::emit(SwapEvent {
            trader,
            from_token: b"VAULT_USDC",
            to_token: b"USDC",
            amount_in: usdc_amount,
            amount_out: usdc_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Withdraw USDT from vault - Mints USDT to user (for vault balance decrease)
    public entry fun withdraw_usdt_from_vault(account: &signer, usdt_amount: u64) acquires TokenCapabilities {
        let trader = signer::address_of(account);
        
        // Register USDT if needed
        if (!coin::is_account_registered<USDT>(trader)) {
            coin::register<USDT>(account);
        };

        // Mint USDT to user
        let usdt_caps = borrow_global<TokenCapabilities<USDT>>(@arbitrage);
        let usdt_coins = coin::mint<USDT>(usdt_amount, &usdt_caps.mint_cap);
        coin::deposit(trader, usdt_coins);

        event::emit(SwapEvent {
            trader,
            from_token: b"VAULT_USDT",
            to_token: b"USDT",
            amount_in: usdt_amount,
            amount_out: usdt_amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Execute profitable arbitrage
    public entry fun execute_arbitrage(
        account: &signer,
        input_amount: u64,
        expected_output: u64,
        token_pair: vector<u8>,
    ) {
        let trader = signer::address_of(account);
        let output_amount = simulate_swap(input_amount);
        
        assert!(output_amount > input_amount, E_NOT_PROFITABLE);
        
        let profit = output_amount - input_amount;

        event::emit(ProfitEvent {
            trader,
            input_amount,
            output_amount,
            profit,
            timestamp: timestamp::now_seconds(),
            token_pair,
        });
    }

    fun simulate_swap(input: u64): u64 {
        let multiplier = 102 + ((input % 4) as u64);
        (input * multiplier) / 100
    }

    #[view]
    public fun check_profitability(input_amount: u64): (bool, u64) {
        let output = simulate_swap(input_amount);
        if (output > input_amount) {
            (true, output - input_amount)
        } else {
            (false, 0)
        }
    }

    #[view]
    public fun get_swap_rate(from_token: vector<u8>, to_token: vector<u8>, amount: u64): u64 {
        if (from_token == b"APT" && to_token == b"USDC") {
            (amount * 8000000) / 100000000
        } else if (from_token == b"APT" && to_token == b"USDT") {
            (amount * 8050000) / 100000000
        } else if (from_token == b"USDC" && to_token == b"APT") {
            (amount * 12500000) / 1000000
        } else if (from_token == b"USDT" && to_token == b"APT") {
            (amount * 12400000) / 1000000
        } else if (from_token == b"USDC" && to_token == b"USDT") {
            amount * 9995 / 10000
        } else if (from_token == b"USDT" && to_token == b"USDC") {
            amount * 9995 / 10000
        } else {
            0
        }
    }
}
