#![no_std]

//! Splitter — atomic multi-recipient settlement for Stellar Remit.
//!
//! The Crowdfund contract is the only authorized caller of `distribute()`.
//! On distribution, each recipient receives their configured basis-point
//! share of the amount, pulled directly from the Crowdfund contract's
//! approved token allowance. The last recipient always receives whatever
//! remains after integer-division rounding, so no dust is ever trapped.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short,
    token::TokenClient, Address, Env, Vec,
};

const INITIALIZED: soroban_sdk::Symbol = symbol_short!("INITED");
const PAYMENT_DISTRIBUTED: soroban_sdk::Symbol = symbol_short!("PAYDIST");

/// Total basis points — shares must sum to this (100.00%).
const BPS_TOTAL: u32 = 10_000;

#[contracttype]
pub enum DataKey {
    Crowdfund,
    Token,
    Recipients,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[contracterror]
pub enum SplitterError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidSplitConfig = 3,
    InvalidAmount = 4,
    UnauthorizedCaller = 5,
}

#[contract]
pub struct Splitter;

#[contractimpl]
impl Splitter {
    /// Lock in permanent state: the authorized Crowdfund caller, the token
    /// contract, and the fixed recipient share table.
    ///
    /// Recipients are expressed in basis points and must sum to exactly
    /// 10,000 (100%). Once initialized, nothing here can be changed —
    /// settlement destinations cannot be substituted after the fact.
    pub fn initialize(
        env: Env,
        crowdfund: Address,
        token: Address,
        recipients: Vec<(Address, u32)>,
    ) -> Result<(), SplitterError> {
        if env.storage().instance().has(&DataKey::Crowdfund) {
            panic_with_error!(&env, SplitterError::AlreadyInitialized);
        }
        if recipients.len() == 0 || total_bps(&env, &recipients) != BPS_TOTAL {
            return Err(SplitterError::InvalidSplitConfig);
        }

        env.storage().instance().set(&DataKey::Crowdfund, &crowdfund);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Recipients, &recipients);

        env.events().publish((INITIALIZED, crowdfund), recipients.len());

        Ok(())
    }

    /// Distribute `amount` of the stored token to the fixed recipient table.
    ///
    /// Only the authorized Crowdfund contract may call this. Authorization is
    /// enforced two ways: the caller argument must equal the address locked at
    /// initialization, and that address must cryptographically authorize the
    /// invocation (`require_auth`), which only succeeds when execution really
    /// originates from the Crowdfund contract itself.
    pub fn distribute(env: Env, caller: Address, amount: i128) -> Result<(), SplitterError> {
        let crowdfund: Address = env
            .storage()
            .instance()
            .get(&DataKey::Crowdfund)
            .unwrap_or_else(|| panic_with_error!(&env, SplitterError::NotInitialized));

        if caller != crowdfund {
            return Err(SplitterError::UnauthorizedCaller);
        }
        caller.require_auth();

        if amount <= 0 {
            return Err(SplitterError::InvalidAmount);
        }

        let recipients: Vec<(Address, u32)> = env
            .storage()
            .instance()
            .get(&DataKey::Recipients)
            .unwrap_or_else(|| panic_with_error!(&env, SplitterError::NotInitialized));
        let token = TokenClient::new(
            &env,
            &env.storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::Token)
                .unwrap_or_else(|| panic_with_error!(&env, SplitterError::NotInitialized)),
        );

        // The Splitter pulls funds from the Crowdfund's approved allowance
        // directly to each recipient — no intermediate hop through the
        // Splitter's own balance.
        let spender = env.current_contract_address();
        let count = recipients.len();

        let mut distributed: i128 = 0;
        for i in 0..count {
            let (recipient, bps) = recipients.get(i).unwrap();
            // Every recipient except the last gets an exact floor(bps share).
            // The last one receives the remainder, guaranteeing zero dust.
            let share: i128 = if i == count - 1 {
                amount - distributed
            } else {
                amount * bps as i128 / BPS_TOTAL as i128
            };
            token.transfer_from(&spender, &crowdfund, &recipient, &share);
            distributed += share;
            env.events().publish((PAYMENT_DISTRIBUTED, recipient), share);
        }

        Ok(())
    }

    /// The fixed recipient table as `(address, basis_points)` pairs.
    pub fn get_recipients(env: Env) -> Vec<(Address, u32)> {
        env.storage()
            .instance()
            .get(&DataKey::Recipients)
            .unwrap_or_else(|| panic_with_error!(&env, SplitterError::NotInitialized))
    }

    /// The authorized Crowdfund contract address.
    pub fn get_crowdfund(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Crowdfund)
            .unwrap_or_else(|| panic_with_error!(&env, SplitterError::NotInitialized))
    }

    /// The token contract used for settlement payouts.
    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(&env, SplitterError::NotInitialized))
    }
}

fn total_bps(_env: &Env, recipients: &Vec<(Address, u32)>) -> u32 {
    let mut sum: u32 = 0;
    for i in 0..recipients.len() {
        let (_, bps) = recipients.get(i).unwrap();
        sum += bps;
    }
    sum
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::vec as svec;

    fn setup_recipients(env: &Env) -> Vec<(Address, u32)> {
        svec![
            env,
            (Address::generate(env), 7000u32),
            (Address::generate(env), 3000u32),
        ]
    }

    #[test]
    fn test_initialize_stores_state() {
        let env = Env::default();
        let crowdfund = Address::generate(&env);
        let token = Address::generate(&env);
        let recipients = setup_recipients(&env);

        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);
        client.initialize(&crowdfund, &token, &recipients);

        assert_eq!(client.get_crowdfund(), crowdfund);
        assert_eq!(client.get_token(), token);
        assert_eq!(client.get_recipients(), recipients);
    }

    #[test]
    fn test_double_initialize_fails() {
        let env = Env::default();
        let crowdfund = Address::generate(&env);
        let token = Address::generate(&env);
        let recipients = setup_recipients(&env);

        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);
        client.initialize(&crowdfund, &token, &recipients);

        assert_eq!(
            client.try_initialize(&crowdfund, &token, &recipients),
            Err(Ok(SplitterError::AlreadyInitialized))
        );
    }

    #[test]
    fn test_invalid_split_config_rejected() {
        let env = Env::default();
        let crowdfund = Address::generate(&env);
        let token = Address::generate(&env);

        let bad_shares = svec![
            &env,
            (Address::generate(&env), 7000u32),
            (Address::generate(&env), 2000u32),
        ];

        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);

        assert_eq!(
            client.try_initialize(&crowdfund, &token, &bad_shares),
            Err(Ok(SplitterError::InvalidSplitConfig))
        );
    }

    #[test]
    fn test_empty_recipients_rejected() {
        let env = Env::default();
        let crowdfund = Address::generate(&env);
        let token = Address::generate(&env);
        let empty: Vec<(Address, u32)> = svec![&env];

        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);

        assert_eq!(
            client.try_initialize(&crowdfund, &token, &empty),
            Err(Ok(SplitterError::InvalidSplitConfig))
        );
    }

    #[test]
    fn test_distribute_rejects_wrong_caller_address() {
        let env = Env::default();
        let crowdfund = Address::generate(&env);
        let token = Address::generate(&env);
        let recipients = setup_recipients(&env);

        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);
        client.initialize(&crowdfund, &token, &recipients);

        let impostor = Address::generate(&env);
        assert_eq!(
            client.try_distribute(&impostor, &1_000i128),
            Err(Ok(SplitterError::UnauthorizedCaller))
        );
    }

    #[test]
    fn test_distribute_rejects_spoofed_crowdfund_address() {
        // Even passing the REAL crowdfund address, a call that does not
        // originate from inside the crowdfund contract fails authorization:
        // require_auth(crowdfund) cannot be satisfied by anyone else.
        let env = Env::default();
        let crowdfund = Address::generate(&env);
        let token = Address::generate(&env);
        let recipients = setup_recipients(&env);

        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);
        client.initialize(&crowdfund, &token, &recipients);

        // No auth mocking — the spoofed authorization must fail.
        assert!(client.try_distribute(&crowdfund, &1_000i128).is_err());
    }

    #[test]
    fn test_getters_fail_before_initialize() {
        let env = Env::default();
        let id = env.register(Splitter, ());
        let client = SplitterClient::new(&env, &id);

        assert_eq!(
            client.try_get_crowdfund(),
            Err(Ok(SplitterError::NotInitialized.into()))
        );
    }
}
