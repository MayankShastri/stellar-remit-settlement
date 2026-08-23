#![no_std]

//! Crowdfund â€” pooled contributions with atomic split settlement.
//!
//! Orange Belt evolution of the Yellow Belt crowdfund contract:
//! - Donations move real tokens (SEP-41) into the contract's own balance.
//! - The Splitter contract address is locked in permanently at
//!   `initialize()` â€” it is never accepted as a runtime argument to
//!   `withdraw()`, so settlement destinations cannot be substituted.
//! - `withdraw()` follows Checks-Effects-Interactions ordering: state is
//!   marked withdrawn *before* any external call, then the Splitter is
//!   authorized (token allowance) and invoked cross-contract to settle all
//!   recipients atomically.
//! - Late donations are rejected once withdrawn, so funds can never become
//!   trapped with no exit path.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short,
    token::TokenClient, Address, Env, IntoVal, Symbol, Val, Vec,
};

/// Function name on the Splitter contract invoked during settlement.
const SPLITTER_DISTRIBUTE: &str = "distribute";

const INITIALIZED: soroban_sdk::Symbol = symbol_short!("INITED");
const DONATION: soroban_sdk::Symbol = symbol_short!("DONATION");
const WITHDRAWN: soroban_sdk::Symbol = symbol_short!("WITHDRAWN");

/// How long (in ledgers) the token allowance granted to the Splitter stays
/// valid. The distribution happens inside the same invocation as the grant,
/// so this only needs to comfortably cover one ledger window.
const APPROVAL_LEDGER_WINDOW: u32 = 200;

#[contracttype]
pub enum DataKey {
    Admin,
    Goal,
    Token,
    Splitter,
    TotalRaised,
    Donor(Address),
    DonorList,
    Withdrawn,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[contracterror]
pub enum CrowdfundError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    GoalNotReached = 4,
    Unauthorized = 5,
    AlreadyWithdrawn = 6,
}

#[contract]
pub struct Crowdfund;

#[contractimpl]
impl Crowdfund {
    /// Initialize the pool. The token contract and the Splitter address are
    /// both locked in permanently here â€” donors can verify on-chain that
    /// their funds can only ever settle through this exact Splitter.
    pub fn initialize(
        env: Env,
        admin: Address,
        goal: i128,
        token: Address,
        splitter: Address,
    ) -> Result<(), CrowdfundError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(CrowdfundError::AlreadyInitialized);
        }
        if goal <= 0 {
            return Err(CrowdfundError::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Goal, &goal);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Splitter, &splitter);
        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::DonorList, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::Withdrawn, &false);

        env.events().publish((INITIALIZED, admin), goal);
        Ok(())
    }

    /// Contribute `amount` of the pool token. Real tokens are transferred
    /// from the donor into the contract's balance. Rejected after withdrawal â€”
    /// a late donation could never be settled and would be trapped forever.
    ///
    /// Returns the new total raised.
    pub fn donate(env: Env, donor: Address, amount: i128) -> Result<i128, CrowdfundError> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(CrowdfundError::NotInitialized);
        }
        if amount <= 0 {
            return Err(CrowdfundError::InvalidAmount);
        }
        let withdrawn: bool = env.storage().instance().get(&DataKey::Withdrawn).unwrap();
        if withdrawn {
            return Err(CrowdfundError::AlreadyWithdrawn);
        }

        donor.require_auth();

        // Interactions first for the inbound transfer, then effects.
        let contract_address = env.current_contract_address();
        let token = TokenClient::new(
            &env,
            &env.storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::Token)
                .unwrap(),
        );
        token.transfer(&donor, &contract_address, &amount);

        let new_total: i128 =
            env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0) + amount;
        env.storage().instance().set(&DataKey::TotalRaised, &new_total);

        let prior_amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Donor(donor.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Donor(donor.clone()), &(prior_amount + amount));

        if prior_amount == 0 {
            let mut donors: Vec<Address> =
                env.storage().instance().get(&DataKey::DonorList).unwrap();
            donors.push_back(donor.clone());
            env.storage().instance().set(&DataKey::DonorList, &donors);
        }

        env.storage().instance().extend_ttl(100, 518_400);

        env.events().publish((DONATION, donor, new_total), amount);
        Ok(new_total)
    }

    /// Settle the pool. Callable once, by the admin, only when the goal is
    /// met. Marks state withdrawn BEFORE any external call (Checks-Effects-
    /// Interactions), then grants the locked Splitter a token allowance for
    /// the full balance and invokes it to distribute every recipient's share
    /// atomically. If any transfer fails, the whole settlement reverts.
    pub fn withdraw(env: Env, admin: Address) -> Result<(), CrowdfundError> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized));
        admin.require_auth();
        if admin != stored_admin {
            return Err(CrowdfundError::Unauthorized);
        }

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalRaised)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized));
        let goal: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Goal)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized));
        if total < goal {
            return Err(CrowdfundError::GoalNotReached);
        }

        let withdrawn: bool = env.storage().instance().get(&DataKey::Withdrawn).unwrap_or(false);
        if withdrawn {
            return Err(CrowdfundError::AlreadyWithdrawn);
        }

        // --- CHECKS complete above; EFFECTS before INTERACTIONS ---
        env.storage().instance().set(&DataKey::Withdrawn, &true);
        env.storage().instance().extend_ttl(100, 518_400);

        // --- INTERACTIONS ---
        let splitter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Splitter)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized));
        let token = TokenClient::new(
            &env,
            &env.storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::Token)
                .unwrap(),
        );
        let contract_address = env.current_contract_address();

        // Authorize the Splitter to pull exactly the pool balance...
        let live_until_ledger = env.ledger().sequence() + APPROVAL_LEDGER_WINDOW;
        token.approve(&contract_address, &splitter, &total, &live_until_ledger);

        // ...then invoke it cross-contract to settle every recipient.
        //
        // Raw invocation (rather than linking the splitter crate) keeps this
        // contract's WASM free of the Splitter's exports; a failing
        // distribute reverts the whole settlement atomically.
        let func = Symbol::new(&env, SPLITTER_DISTRIBUTE);
        let mut args = Vec::<Val>::new(&env);
        args.push_back(contract_address.to_val());
        args.push_back(total.into_val(&env));
        let _: Val = env.invoke_contract(&splitter, &func, args);

        env.events()
            .publish((WITHDRAWN, admin, splitter), total);
        Ok(())
    }

    /// `(total_raised, goal)` in stroops.
    pub fn get_progress(env: Env) -> (i128, i128) {
        let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0);
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap_or(0);
        (total, goal)
    }

    /// All donors with their cumulative contribution amounts.
    pub fn get_donors(env: Env) -> Vec<(Address, i128)> {
        let donor_list: Vec<Address> = match env
            .storage()
            .instance()
            .get::<DataKey, Vec<Address>>(&DataKey::DonorList)
        {
            Some(list) => list,
            None => return Vec::new(&env),
        };
        let mut result = Vec::new(&env);
        for i in 0..donor_list.len() {
            let addr = donor_list.get(i).unwrap();
            let amt: i128 = env
                .storage()
                .instance()
                .get(&DataKey::Donor(addr.clone()))
                .unwrap_or(0);
            result.push_back((addr, amt));
        }
        result
    }

    /// Cumulative amount donated by a single address.
    pub fn get_donor_amount(env: Env, donor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Donor(donor))
            .unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized))
    }

    pub fn get_goal(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Goal)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized))
    }

    /// The locked token contract address.
    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized))
    }

    /// The locked Splitter contract address â€” verifiable by donors before
    /// contributing, immutable after initialization.
    pub fn get_splitter(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Splitter)
            .unwrap_or_else(|| panic_with_error!(&env, CrowdfundError::NotInitialized))
    }

    /// Whether the pool has already been settled.
    pub fn get_withdrawn(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Withdrawn).unwrap_or(false)
    }
}


#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        token::{Client as TokenClient, StellarAssetClient},
        vec as svec,
    };
    use splitter::Splitter;

    const GOAL: i128 = 100 * 10_000_000; // 100 XLM in stroops

    struct Setup {
        env: Env,
        crowdfund_id: Address,
        token_id: Address,
        admin: Address,
        beneficiary: Address,
        provider: Address,
    }

    impl Setup {
        fn crowdfund(&self) -> CrowdfundClient<'_> {
            CrowdfundClient::new(&self.env, &self.crowdfund_id)
        }
        fn token(&self) -> TokenClient<'_> {
            TokenClient::new(&self.env, &self.token_id)
        }
        fn sac(&self) -> StellarAssetClient<'_> {
            StellarAssetClient::new(&self.env, &self.token_id)
        }
        fn mint(&self, to: &Address, amount: i128) {
            self.sac().mint(to, &amount);
        }

        /// Deploy Splitter + Crowdfund wired together. `goal` and the
        /// beneficiary/provider basis-point shares are configurable so tests
        /// can exercise odd totals and custom splits.
        fn create(goal: i128, bps: (u32, u32)) -> Setup {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let beneficiary = Address::generate(&env);
            let provider = Address::generate(&env);

            // Test token contract (SAC wrapping a generated asset).
            let sac_contract = env.register_stellar_asset_contract_v2(admin.clone());
            let token_id = sac_contract.address();

            // Deploy BOTH contracts first — each needs the other's address
            // at initialization time (deployment and initialization are
            // separate steps; this breaks the mutual dependency).
            let splitter_id = env.register(Splitter, ());
            let crowdfund_id = env.register(Crowdfund, ());

            // Initialize the Splitter against the Crowdfund's address...
            let recipients =
                svec![&env, (beneficiary.clone(), bps.0), (provider.clone(), bps.1)];
            splitter::SplitterClient::new(&env, &splitter_id)
                .initialize(&crowdfund_id, &token_id, &recipients);

            // ...then initialize the Crowdfund against the Splitter's.
            CrowdfundClient::new(&env, &crowdfund_id)
                .initialize(&admin, &goal, &token_id, &splitter_id);

            Setup {
                env,
                crowdfund_id,
                token_id,
                admin,
                beneficiary,
                provider,
            }
        }
    }

    #[test]
    fn test_initialize_sets_goal_and_admin() {
        let s = Setup::create(GOAL, (7000, 3000));
        let c = s.crowdfund();

        let (total, goal) = c.get_progress();
        assert_eq!(total, 0);
        assert_eq!(goal, GOAL);
        assert_eq!(c.get_admin(), s.admin);
        assert_eq!(c.get_token(), s.token_id);
        assert!(c.get_splitter() != s.crowdfund_id); // locked, separate contract
        assert!(!c.get_withdrawn());
    }

    #[test]
    fn test_donate_updates_raised_and_emits_event() {
        let s = Setup::create(GOAL, (7000, 3000));
        let donor = Address::generate(&s.env);
        s.mint(&donor, 60 * 10_000_000);

        let returned = s.crowdfund().donate(&donor, &(60 * 10_000_000));
        assert_eq!(returned, 60 * 10_000_000);

        let c = s.crowdfund();
        let (total, _) = c.get_progress();
        assert_eq!(total, 60 * 10_000_000);
        // Real tokens moved into the contract's own balance.
        assert_eq!(s.token().balance(&donor), 0);
        assert_eq!(s.token().balance(&s.crowdfund_id), 60 * 10_000_000);
        assert_eq!(c.get_donor_amount(&donor), 60 * 10_000_000);
    }

    #[test]
    fn test_multiple_donors_tracked() {
        let s = Setup::create(GOAL, (7000, 3000));
        let d1 = Address::generate(&s.env);
        let d2 = Address::generate(&s.env);
        s.mint(&d1, 40 * 10_000_000);
        s.mint(&d2, 70 * 10_000_000);

        s.crowdfund().donate(&d1, &(30 * 10_000_000));
        s.crowdfund().donate(&d2, &(70 * 10_000_000));
        s.crowdfund().donate(&d1, &(10 * 10_000_000)); // top-up

        let donors = s.crowdfund().get_donors();
        assert_eq!(donors.len(), 2);
        let mut d1_total: Option<i128> = None;
        for i in 0..donors.len() {
            let (addr, amt) = donors.get(i).unwrap();
            if addr == d1 {
                d1_total = Some(amt);
            }
        }
        assert_eq!(d1_total, Some(40 * 10_000_000));
    }

    #[test]
    fn test_donate_fails_before_initialize() {
        let env = Env::default();
        let id = env.register(Crowdfund, ());
        let client = CrowdfundClient::new(&env, &id);
        let donor = Address::generate(&env);

        assert_eq!(
            client.try_donate(&donor, &100i128),
            Err(Ok(CrowdfundError::NotInitialized.into()))
        );
    }

    #[test]
    fn test_donate_fails_on_invalid_amount() {
        let s = Setup::create(GOAL, (7000, 3000));
        let donor = Address::generate(&s.env);

        assert_eq!(
            s.crowdfund().try_donate(&donor, &0i128),
            Err(Ok(CrowdfundError::InvalidAmount.into()))
        );
        assert_eq!(
            s.crowdfund().try_donate(&donor, &-5i128),
            Err(Ok(CrowdfundError::InvalidAmount.into()))
        );
    }

    #[test]
    fn test_withdraw_fails_before_goal_met() {
        let s = Setup::create(GOAL, (7000, 3000));
        let donor = Address::generate(&s.env);
        s.mint(&donor, 99 * 10_000_000);
        s.crowdfund().donate(&donor, &(99 * 10_000_000));

        assert_eq!(
            s.crowdfund().try_withdraw(&s.admin),
            Err(Ok(CrowdfundError::GoalNotReached.into()))
        );
    }

    #[test]
    fn test_unauthorized_withdraw_fails() {
        let s = Setup::create(GOAL, (7000, 3000));
        let donor = Address::generate(&s.env);
        s.mint(&donor, GOAL);
        s.crowdfund().donate(&donor, &GOAL);

        let attacker = Address::generate(&s.env);
        assert_eq!(
            s.crowdfund().try_withdraw(&attacker),
            Err(Ok(CrowdfundError::Unauthorized.into()))
        );
    }

    #[test]
    fn test_double_withdraw_fails() {
        let s = Setup::create(GOAL, (7000, 3000));
        let donor = Address::generate(&s.env);
        s.mint(&donor, GOAL);
        s.crowdfund().donate(&donor, &GOAL);

        s.crowdfund().withdraw(&s.admin);
        assert!(s.crowdfund().get_withdrawn());

        assert_eq!(
            s.crowdfund().try_withdraw(&s.admin),
            Err(Ok(CrowdfundError::AlreadyWithdrawn.into()))
        );
    }

    #[test]
    fn test_withdraw_succeeds_and_triggers_split() {
        let s = Setup::create(GOAL, (7000, 3000));
        let d1 = Address::generate(&s.env);
        let d2 = Address::generate(&s.env);
        s.mint(&d1, 60 * 10_000_000);
        s.mint(&d2, 40 * 10_000_000);
        s.crowdfund().donate(&d1, &(60 * 10_000_000));
        s.crowdfund().donate(&d2, &(40 * 10_000_000));

        let b_before = s.token().balance(&s.beneficiary);
        let p_before = s.token().balance(&s.provider);

        s.crowdfund().withdraw(&s.admin);

        // Exact 70/30 settlement, atomic, nothing left behind.
        assert_eq!(
            s.token().balance(&s.beneficiary),
            b_before + 70 * 10_000_000
        );
        assert_eq!(s.token().balance(&s.provider), p_before + 30 * 10_000_000);
        assert_eq!(s.token().balance(&s.crowdfund_id), 0);
        assert!(s.crowdfund().get_withdrawn());
    }

    #[test]
    fn test_split_handles_remainder_dust() {
        // Odd goal with a 50/50 split: floor division would strand dust if
        // the last recipient did not receive the remainder.
        let odd_goal: i128 = 10_005; // stroops
        let s = Setup::create(odd_goal, (5000, 5000));
        let donor = Address::generate(&s.env);
        s.mint(&donor, odd_goal);
        s.crowdfund().donate(&donor, &odd_goal);

        let b_before = s.token().balance(&s.beneficiary);
        let p_before = s.token().balance(&s.provider);

        s.crowdfund().withdraw(&s.admin);

        let first_share = odd_goal / 2; // 5002
        assert_eq!(s.token().balance(&s.beneficiary), b_before + first_share);
        assert_eq!(
            s.token().balance(&s.provider),
            p_before + (odd_goal - first_share) // 5003, dust included
        );
        assert_eq!(s.token().balance(&s.crowdfund_id), 0);
    }

    #[test]
    fn test_donate_fails_after_withdrawn() {
        let s = Setup::create(GOAL, (7000, 3000));
        let donor = Address::generate(&s.env);
        s.mint(&donor, GOAL);
        s.crowdfund().donate(&donor, &GOAL);
        s.crowdfund().withdraw(&s.admin);

        let late_donor = Address::generate(&s.env);
        s.mint(&late_donor, 25 * 10_000_000);

        assert_eq!(
            s.crowdfund().try_donate(&late_donor, &(25 * 10_000_000)),
            Err(Ok(CrowdfundError::AlreadyWithdrawn.into()))
        );
        // The late contribution never moved.
        assert_eq!(s.token().balance(&late_donor), 25 * 10_000_000);
        assert_eq!(s.token().balance(&s.crowdfund_id), 0);
    }

    #[test]
    fn test_lifecycle_emits_events() {
        let s = Setup::create(GOAL, (7000, 3000));
        // Initialization event.
        assert!(
            std::format!("{:?}", s.env.events().all()).contains("StringM(INITED)"),
            "initialized event missing"
        );

        let donor = Address::generate(&s.env);
        s.mint(&donor, GOAL);
        s.crowdfund().donate(&donor, &GOAL);
        // Donation event (checked before the next invocation rotates events).
        assert!(
            std::format!("{:?}", s.env.events().all()).contains("StringM(DONATION)"),
            "donation event missing"
        );

        s.crowdfund().withdraw(&s.admin);
        let rendered = std::format!("{:?}", s.env.events().all());
        assert!(rendered.contains("StringM(WITHDRAWN)"), "withdrawn event missing");
        assert!(rendered.contains("StringM(PAYDIST)"), "distribution event missing");
    }
}
