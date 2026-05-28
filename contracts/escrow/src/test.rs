#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, String,
};

fn setup_test() -> (
    Env,
    EscrowContractClient<'static>,
    Address,
    Address,
    Address,
    token::Client<'static>,
    token::Client<'static>,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let farmer = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let xlm_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let xlm_client = token::Client::new(&env, &xlm_contract.address());
    let xlm_sac_client = token::StellarAssetClient::new(&env, &xlm_contract.address());

    xlm_sac_client.mint(&buyer, &10000);

    let usdc_contract = env.register_stellar_asset_contract_v2(token_admin);
    let usdc_client = token::Client::new(&env, &usdc_contract.address());

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let mut supported_tokens = Vec::new(&env);
    supported_tokens.push_back(xlm_client.address.clone());
    supported_tokens.push_back(usdc_client.address.clone());

    let fee_collector = Address::generate(&env);

    client.initialize(&admin, &fee_collector, &supported_tokens);

    (
        env,
        client,
        buyer,
        farmer,
        fee_collector,
        xlm_client,
        usdc_client,
        admin,
    )
}

fn create_test_with_tokens() -> (
    Env,
    EscrowContractClient<'static>,
    Address,
    Address,
    Address,
    token::Client<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let farmer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let xlm_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let xlm_client = token::Client::new(&env, &xlm_contract.address());
    let xlm_admin_client = token::StellarAssetClient::new(&env, &xlm_contract.address());
    xlm_admin_client.mint(&buyer, &1000);

    // Register the second required token; only its address is needed for the whitelist.
    let usdc_address = env.register_stellar_asset_contract_v2(token_admin).address();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let mut supported_tokens = Vec::new(&env);
    supported_tokens.push_back(xlm_client.address.clone());
    supported_tokens.push_back(usdc_address);

    let fee_collector = Address::generate(&env);
    client.initialize(&admin, &fee_collector, &supported_tokens);

    (env, client, admin, buyer, farmer, xlm_client)
}

#[test]
fn test_create_and_confirm_order() {
    let (_env, client, buyer, farmer, _collector, token, _, _) = setup_test();

    assert_eq!(token.balance(&buyer), 10000);
    assert_eq!(token.balance(&farmer), 0);

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    assert_eq!(order_id, 1);

    let order_details = client.get_order_details(&order_id);
    assert_eq!(order_details.status, OrderStatus::Pending);
    assert_eq!(order_details.delivery_timestamp, 0);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let order_after = client.get_order_details(&order_id);
    assert_eq!(order_after.status, OrderStatus::Completed);
}

#[test]
fn test_mark_delivered_then_confirm() {
    let (_env, client, buyer, farmer, _collector, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().mark_delivered(&farmer, &order_id);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Pending);
    assert!(order.delivery_timestamp > 0);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let order_after = client.get_order_details(&order_id);
    assert_eq!(order_after.status, OrderStatus::Completed);
}

#[test]
fn test_mark_delivered_wrong_farmer_fails() {
    let (env, client, buyer, farmer, _, token, _, _) = setup_test();
    let fake_farmer = Address::generate(&env);

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let result = client
        .mock_all_auths()
        .try_mark_delivered(&fake_farmer, &order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::NotFarmer);
}

#[test]
fn test_mark_delivered_twice_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().mark_delivered(&farmer, &order_id);

    let result = client
        .mock_all_auths()
        .try_mark_delivered(&farmer, &order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotPending);
}

#[test]
fn test_confirm_without_mark_delivered() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Completed);
}

#[test]
fn test_confirm_already_completed() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let result = client
        .mock_all_auths()
        .try_confirm_receipt(&buyer, &order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotPending);
}

#[test]
fn test_refund_expired_order() {
    let (env, client, buyer, farmer, _collector, token, _, _, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 345_601);

    client.mock_all_auths().refund_expired_order(&order_id);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Refunded);
}

#[test]
fn test_refund_unexpired_order_fails() {
    let (env, client, buyer, farmer, _, token, _, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    env.ledger().set_timestamp(env.ledger().timestamp() + 3600);

    let result = client.mock_all_auths().try_refund_expired_order(&order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotExpired);
}

#[test]
fn test_create_order_unsupported_token_fails() {
    let (env, client, buyer, farmer, _, _, _, _, _) = setup_test();
    let unsupported_token_admin = Address::generate(&env);
    let unsupported_contract = env.register_stellar_asset_contract_v2(unsupported_token_admin);
    let unsupported_client = token::Client::new(&env, &unsupported_contract.address());

    let result = client.mock_all_auths().try_create_order(
        &buyer,
        &farmer,
        &unsupported_client.address,
        &500,
    );
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::UnsupportedToken);
}

#[test]
fn test_platform_fee_acceptance_criteria() {
    let (_env, client, buyer, farmer, collector, token, _, _) = setup_test();

    let amount = 1000;

    client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &amount);

    assert_eq!(token.balance(&collector), 30);
    let order_details = client.get_order_details(&1);
    assert_eq!(order_details.amount, 970);

    client.mock_all_auths().confirm_receipt(&buyer, &1);
    assert_eq!(token.balance(&farmer), 970);
}

#[test]
fn test_open_dispute_by_buyer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&_env, "Product damaged");
    let evidence_hash = String::from_str(&_env, "QmHash123");

    client
        .mock_all_auths()
        .open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Disputed);

    let dispute = client.get_dispute(&order_id);
    assert_eq!(dispute.opened_by, buyer);
    assert_eq!(dispute.resolved, false);
}

#[test]
fn test_open_dispute_by_farmer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&_env, "Buyer not responding");
    let evidence_hash = String::from_str(&_env, "QmHash456");

    client
        .mock_all_auths()
        .open_dispute(&farmer, &order_id, &reason, &evidence_hash);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Disputed);

    let dispute = client.get_dispute(&order_id);
    assert_eq!(dispute.opened_by, farmer);
    assert_eq!(dispute.resolved, false);
}

#[test]
fn test_open_dispute_not_pending_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let reason = String::from_str(&_env, "Issue with order");
    let evidence_hash = String::from_str(&_env, "QmHash789");

    let result =
        client
            .mock_all_auths()
            .try_open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotPending);
}

#[test]
fn test_open_dispute_not_participant_fails() {
    let (env, client, buyer, farmer, _, token, _, _) = setup_test();
    let non_participant = Address::generate(&env);

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&env, "Not involved");
    let evidence_hash = String::from_str(&env, "QmHashXYZ");

    let result = client.mock_all_auths().try_open_dispute(
        &non_participant,
        &order_id,
        &reason,
        &evidence_hash,
    );

    assert_eq!(
        result.unwrap_err().unwrap(),
        EscrowError::NotOrderParticipant
    );
}

#[test]
fn test_open_dispute_duplicate_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&_env, "First dispute");
    let evidence_hash = String::from_str(&_env, "QmHash111");

    client
        .mock_all_auths()
        .open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    let reason2 = String::from_str(&_env, "Second dispute");
    let evidence_hash2 = String::from_str(&_env, "QmHash222");

    let result =
        client
            .mock_all_auths()
            .try_open_dispute(&buyer, &order_id, &reason2, &evidence_hash2);

    assert_eq!(
        result.unwrap_err().unwrap(),
        EscrowError::DisputeAlreadyExists
    );
}

#[test]
fn test_resolve_dispute_refund() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&_env, "Product not received");
    let evidence_hash = String::from_str(&_env, "QmHashRefund");

    client
        .mock_all_auths()
        .open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    client
        .mock_all_auths()
        .resolve_dispute(&admin, &order_id, &DisputeResolution::Refund);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Refunded);
}

#[test]
fn test_resolve_dispute_release() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&_env, "Farmer delivered goods");
    let evidence_hash = String::from_str(&_env, "QmHashRelease");

    client
        .mock_all_auths()
        .open_dispute(&farmer, &order_id, &reason, &evidence_hash);

    client
        .mock_all_auths()
        .resolve_dispute(&admin, &order_id, &DisputeResolution::Release);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Completed);
}

#[test]
fn test_resolve_dispute_split_50_50() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &1000);

    let reason = String::from_str(&_env, "Partial fulfillment");
    let evidence_hash = String::from_str(&_env, "QmHashSplit50");

    client
        .mock_all_auths()
        .open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    client
        .mock_all_auths()
        .resolve_dispute(&admin, &order_id, &DisputeResolution::Split(5000));

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Completed);
}

#[test]
fn test_resolve_dispute_not_admin_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();
    let (env, _, admin, _, _, _) = create_test_with_tokens();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&env, "Dispute");
    let evidence_hash = String::from_str(&env, "QmHashNotAdmin");

    client
        .mock_all_auths()
        .open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    let not_admin = Address::generate(&env);
    let result = client.mock_all_auths().try_resolve_dispute(
        &not_admin,
        &order_id,
        &DisputeResolution::Refund,
    );

    assert_eq!(result.unwrap_err().unwrap(), EscrowError::NotAdmin);
}

#[test]
fn test_resolve_dispute_not_disputed_fails() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let result =
        client
            .mock_all_auths()
            .try_resolve_dispute(&admin, &order_id, &DisputeResolution::Refund);

    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotDisputed);
}

#[test]
fn test_resolve_dispute_invalid_split_ratio_fails() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let reason = String::from_str(&_env, "Dispute");
    let evidence_hash = String::from_str(&_env, "QmHashInvalidRatio");

    client
        .mock_all_auths()
        .open_dispute(&buyer, &order_id, &reason, &evidence_hash);

    let result = client.mock_all_auths().try_resolve_dispute(
        &admin,
        &order_id,
        &DisputeResolution::Split(15000),
    );

    assert_eq!(result.unwrap_err().unwrap(), EscrowError::InvalidSplitRatio);
}

#[test]
fn test_get_orders_by_buyer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let _order_id1 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let _order_id2 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &300);

    let orders = client.get_orders_by_buyer(&buyer);
    assert_eq!(orders.len(), 2);
}

#[test]
fn test_get_orders_by_farmer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    let _order_id1 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let orders = client.get_orders_by_farmer(&farmer);
    assert_eq!(orders.len(), 1);
}

#[test]
fn test_initialize_with_only_one_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let xlm_contract = env.register_stellar_asset_contract_v2(token_admin);
    let xlm_address = xlm_contract.address();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let mut one_token = Vec::new(&env);
    one_token.push_back(xlm_address);

    let result = client.try_initialize(&admin, &fee_collector, &one_token);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::MustSupportTwoTokens);
}

#[test]
fn test_initialize_duplicate_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let xlm_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let usdc_address = env.register_stellar_asset_contract_v2(token_admin).address();

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let mut tokens = Vec::new(&env);
    tokens.push_back(xlm_contract.address());
    tokens.push_back(usdc_address);

    client.initialize(&admin, &fee_collector, &tokens);

    let result = client.try_initialize(&admin, &fee_collector, &tokens);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::AlreadyInitialized);
}

// ── Getter tests (Issue #275) ─────────────────────────────────────────────────

#[test]
fn test_get_admin() {
    let (_env, client, _buyer, _farmer, _collector, _token, _, admin, _) = setup_test();
    
    let retrieved_admin = client.get_admin();
    assert_eq!(retrieved_admin, admin);
}

#[test]
fn test_get_fee_collector() {
    let (_env, client, _buyer, _farmer, collector, _token, _, _, _) = setup_test();
    
    let retrieved_collector = client.get_fee_collector();
    assert_eq!(retrieved_collector, collector);
}

#[test]
fn test_get_order_count() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();
    
    assert_eq!(client.get_order_count(), 0);
    
    client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &500);
    assert_eq!(client.get_order_count(), 1);
    
    client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &300);
    assert_eq!(client.get_order_count(), 2);
}

// ── Arithmetic Edge Cases Tests (Issue #276) ─────────────────────────────────

#[test]
fn test_fee_calculation_with_small_amounts() {
    let (_env, client, buyer, farmer, collector, token, _, _) = setup_test();
    
    // Test with 1 unit - fee should be 0 (3% of 1 = 0.03, rounds down to 0)
    let initial_balance = token.balance(&buyer);
    client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &1);
    
    let fee_collected = token.balance(&collector);
    let order = client.get_order_details(&1);
    
    // With amount=1, fee=0, net_amount=1
    assert_eq!(fee_collected, 0);
    assert_eq!(order.amount, 1);
    assert_eq!(token.balance(&buyer), initial_balance - 1);
}

#[test]
fn test_fee_calculation_with_large_amounts() {
    let (env, client, buyer, farmer, collector, token, _, _, _) = setup_test();
    
    // Mint large amount
    let sac_client = token::StellarAssetClient::new(&env, &token.address);
    sac_client.mint(&buyer, &i128::MAX / 2);
    
    let large_amount = 1_000_000_000;
    client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &large_amount);
    
    let expected_fee = large_amount * 3 / 100;
    let expected_net = large_amount - expected_fee;
    
    assert_eq!(token.balance(&collector), expected_fee);
    let order = client.get_order_details(&1);
    assert_eq!(order.amount, expected_net);
}

#[test]
fn test_fee_rounding_consistency() {
    let (_env, client, buyer, farmer, collector, token, _, _) = setup_test();
    
    // Test various amounts to ensure consistent rounding
    let test_amounts = vec![33, 67, 99, 100, 101, 333, 999];
    
    for (idx, amount) in test_amounts.iter().enumerate() {
        let order_id = (idx + 1) as u64;
        client.mock_all_auths().create_order(&buyer, &farmer, &token.address, amount);
        
        let expected_fee = amount * 3 / 100;
        let expected_net = amount - expected_fee;
        
        let order = client.get_order_details(&order_id);
        assert_eq!(order.amount, expected_net);
    }
}

#[test]
fn test_split_ratio_zero_percent() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();
    
    let order_id = client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &1000);
    
    let reason = String::from_str(&_env, "Test");
    let evidence = String::from_str(&_env, "QmHash");
    client.mock_all_auths().open_dispute(&buyer, &order_id, &reason, &evidence);
    
    let farmer_balance_before = token.balance(&farmer);
    
    // 0% to buyer means 100% to farmer
    client.mock_all_auths().resolve_dispute(&admin, &order_id, &DisputeResolution::Split(0));
    
    let order = client.get_order_details(&order_id);
    assert_eq!(token.balance(&farmer), farmer_balance_before + order.amount);
}

#[test]
fn test_split_ratio_fifty_percent() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();
    
    let order_id = client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &1000);
    
    let reason = String::from_str(&_env, "Test");
    let evidence = String::from_str(&_env, "QmHash");
    client.mock_all_auths().open_dispute(&buyer, &order_id, &reason, &evidence);
    
    let buyer_balance_before = token.balance(&buyer);
    let farmer_balance_before = token.balance(&farmer);
    
    // 50% split (5000 basis points)
    client.mock_all_auths().resolve_dispute(&admin, &order_id, &DisputeResolution::Split(5000));
    
    let order = client.get_order_details(&order_id);
    let expected_buyer_share = order.amount / 2;
    let expected_farmer_share = order.amount - expected_buyer_share;
    
    assert_eq!(token.balance(&buyer), buyer_balance_before + expected_buyer_share);
    assert_eq!(token.balance(&farmer), farmer_balance_before + expected_farmer_share);
}

#[test]
fn test_split_ratio_hundred_percent() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();
    
    let order_id = client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &1000);
    
    let reason = String::from_str(&_env, "Test");
    let evidence = String::from_str(&_env, "QmHash");
    client.mock_all_auths().open_dispute(&buyer, &order_id, &reason, &evidence);
    
    let buyer_balance_before = token.balance(&buyer);
    
    // 100% to buyer (10000 basis points)
    client.mock_all_auths().resolve_dispute(&admin, &order_id, &DisputeResolution::Split(10000));
    
    let order = client.get_order_details(&order_id);
    assert_eq!(token.balance(&buyer), buyer_balance_before + order.amount);
}

#[test]
fn test_split_ratio_over_hundred_percent_fails() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();
    
    let order_id = client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &1000);
    
    let reason = String::from_str(&_env, "Test");
    let evidence = String::from_str(&_env, "QmHash");
    client.mock_all_auths().open_dispute(&buyer, &order_id, &reason, &evidence);
    
    // Over 100% should fail
    let result = client.mock_all_auths().try_resolve_dispute(
        &admin,
        &order_id,
        &DisputeResolution::Split(10001)
    );
    
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::InvalidSplitRatio);
}

#[test]
fn test_zero_amount_order_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();
    
    let result = client.mock_all_auths().try_create_order(&buyer, &farmer, &token.address, &0);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::AmountMustBePositive);
}

#[test]
fn test_negative_amount_order_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();
    
    let result = client.mock_all_auths().try_create_order(&buyer, &farmer, &token.address, &-100);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::AmountMustBePositive);
}


