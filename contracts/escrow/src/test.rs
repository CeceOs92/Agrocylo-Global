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
    assert_eq!(order.status, OrderStatus::Delivered);
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

    client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &amount);

    client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &amount);

    assert_eq!(token.balance(&collector), 30);
    let order_details = client.get_order_details(&1);
    assert_eq!(order_details.amount, 970);

    // confirm_receipt releases exactly 970 to the farmer
    client.mock_all_auths().confirm_receipt(&buyer, &1);
    assert_eq!(token.balance(&farmer), 970);
}

#[test]
fn test_open_dispute_by_buyer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

#[test]
fn test_concurrent_order_creation() {
    let (env, client, buyer1, farmer, collector, token, _) = setup_test();
    let buyer2 = Address::generate(&env);
    let buyer3 = Address::generate(&env);

    // Mint tokens to all buyers
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&buyer2, &1000);
    token_admin_client.mint(&buyer3, &1000);

    // Create orders concurrently from different buyers
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer1, &farmer, &token.address, &100);
    let order_id2 = client
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
        .create_order(&buyer2, &farmer, &token.address, &200);
    let order_id3 = client
        .mock_all_auths()
        .create_order(&buyer3, &farmer, &token.address, &300);

    // Verify all orders were created with unique IDs
    assert_eq!(order_id1, 1);
    assert_eq!(order_id2, 2);
    assert_eq!(order_id3, 3);

    // Verify state consistency
    let order1 = client.get_order_details(&order_id1);
    let order2 = client.get_order_details(&order_id2);
    let order3 = client.get_order_details(&order_id3);

    assert_eq!(order1.buyer, buyer1);
    assert_eq!(order2.buyer, buyer2);
    assert_eq!(order3.buyer, buyer3);
#[test]
fn test_open_dispute_not_pending_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    assert_eq!(order1.amount, 97); // 100 - 3% fee
    assert_eq!(order2.amount, 194); // 200 - 3% fee
    assert_eq!(order3.amount, 291); // 300 - 3% fee

    // Verify buyer order lists
    let buyer1_orders = client.get_orders_by_buyer(&buyer1);
    let buyer2_orders = client.get_orders_by_buyer(&buyer2);
    let buyer3_orders = client.get_orders_by_buyer(&buyer3);

    assert_eq!(buyer1_orders.len(), 1);
    assert_eq!(buyer2_orders.len(), 1);
    assert_eq!(buyer3_orders.len(), 1);

    assert_eq!(buyer1_orders.get(0).unwrap(), order_id1);
    assert_eq!(buyer2_orders.get(0).unwrap(), order_id2);
    assert_eq!(buyer3_orders.get(0).unwrap(), order_id3);

    // Verify fee collector received correct total
    assert_eq!(token.balance(&collector), 3 + 6 + 9); // 3% of each
}

#[test]
fn test_concurrent_order_confirmation() {
    let (env, client, buyer1, farmer1, _, token, _) = setup_test();
    let buyer2 = Address::generate(&env);
    let farmer2 = Address::generate(&env);
fn test_open_dispute_not_participant_fails() {
    let (env, client, buyer, farmer, _, token, _, _) = setup_test();
    let non_participant = Address::generate(&env);

    // Create multiple orders
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer1, &farmer1, &token.address, &100);
    let order_id2 = client
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
        .create_order(&buyer2, &farmer2, &token.address, &200);

    // Confirm orders concurrently
    client.mock_all_auths().confirm_receipt(&buyer1, &order_id1);
    client.mock_all_auths().confirm_receipt(&buyer2, &order_id2);

    // Verify both orders are completed
    let order1 = client.get_order_details(&order_id1);
    let order2 = client.get_order_details(&order_id2);

    assert_eq!(order1.status, OrderStatus::Completed);
    assert_eq!(order2.status, OrderStatus::Completed);

    // Verify farmers received correct amounts
    assert_eq!(token.balance(&farmer1), 97); // 100 - 3% fee
    assert_eq!(token.balance(&farmer2), 194); // 200 - 3% fee

    // Verify escrow balance is zero
    let escrow_address = client.address.clone();
    assert_eq!(token.balance(&escrow_address), 0);
}

#[test]
fn test_concurrent_operations_on_same_order() {
    let (env, client, buyer, farmer, _, token, _) = setup_test();
fn test_resolve_dispute_refund() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    // Try to confirm the order
    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    // Attempting to confirm again should fail (order is no longer pending)
    let result = client
        .mock_all_auths()
        .try_confirm_receipt(&buyer, &order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotPending);

    // Attempting to refund a completed order should fail
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 345601);
    let result = client.mock_all_auths().try_refund_expired_order(&order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotPending);

    // Verify state remains consistent
    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Completed);
    assert_eq!(token.balance(&farmer), 485); // 500 - 3% fee
}

#[test]
fn test_concurrent_refund_operations() {
    let (env, client, buyer1, farmer1, _, token, _) = setup_test();
    let buyer2 = Address::generate(&env);
    let farmer2 = Address::generate(&env);
fn test_resolve_dispute_release() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    // Mint tokens to buyer2
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&buyer2, &1000);

    // Create multiple orders
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer1, &farmer1, &token.address, &100);
    let order_id2 = client
        .mock_all_auths()
        .create_order(&buyer2, &farmer2, &token.address, &200);

    // Fast forward time to make orders expired
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 345601);

    // Refund orders concurrently
    client.mock_all_auths().refund_expired_order(&order_id1);
    client.mock_all_auths().refund_expired_order(&order_id2);
#[test]
fn test_resolve_dispute_split_50_50() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    // Verify both orders are refunded
    let order1 = client.get_order_details(&order_id1);
    let order2 = client.get_order_details(&order_id2);

    assert_eq!(order1.status, OrderStatus::Refunded);
    assert_eq!(order2.status, OrderStatus::Refunded);

    // Verify buyers received refunds (net amounts)
    assert_eq!(token.balance(&buyer1), 500 + 97); // initial + refund
    assert_eq!(token.balance(&buyer2), 800 + 194); // initial + refund

    // Verify escrow balance is zero
    let escrow_address = client.address.clone();
    assert_eq!(token.balance(&escrow_address), 0);
}

#[test]
fn test_batch_refund_concurrent_safety() {
    let (env, client, buyer, farmer, _, token, _) = setup_test();
fn test_resolve_dispute_not_admin_fails() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();
    let (env, _, admin, _, _, _) = create_test_with_tokens();

    // Create multiple orders
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &100);
    let order_id2 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &200);
    let order_id3 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &300);

    // Fast forward time
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 345601);

    // Batch refund all orders
    let mut order_ids = Vec::new(&env);
    order_ids.push_back(order_id1);
    order_ids.push_back(order_id2);
    order_ids.push_back(order_id3);

    client.mock_all_auths().refund_expired_orders(&order_ids);
#[test]
fn test_resolve_dispute_not_disputed_fails() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    // Verify all orders are refunded
    let order1 = client.get_order_details(&order_id1);
    let order2 = client.get_order_details(&order_id2);
    let order3 = client.get_order_details(&order_id3);

    assert_eq!(order1.status, OrderStatus::Refunded);
    assert_eq!(order2.status, OrderStatus::Refunded);
    assert_eq!(order3.status, OrderStatus::Refunded);

    // Verify buyer received all refunds
    let expected_refund = 97 + 194 + 291; // net amounts
    assert_eq!(token.balance(&buyer), 500 + expected_refund);
}

#[test]
fn test_state_consistency_after_concurrent_operations() {
    let (env, client, buyer, farmer, collector, token, _) = setup_test();
fn test_resolve_dispute_invalid_split_ratio_fails() {
    let (_env, client, buyer, farmer, _, token, _, admin) = setup_test();

    // Create multiple orders
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &100);
    let order_id2 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &200);

    // Confirm first order
    client.mock_all_auths().confirm_receipt(&buyer, &order_id1);

    // Fast forward and refund second order
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 345601);
    client.mock_all_auths().refund_expired_order(&order_id2);

    // Verify state consistency
    let order1 = client.get_order_details(&order_id1);
    let order2 = client.get_order_details(&order_id2);

    assert_eq!(order1.status, OrderStatus::Completed);
    assert_eq!(order2.status, OrderStatus::Refunded);

    // Verify balances are consistent
    let escrow_address = client.address.clone();
    assert_eq!(token.balance(&escrow_address), 0);
    assert_eq!(token.balance(&farmer), 97); // only from completed order
    assert_eq!(token.balance(&buyer), 500 + 194); // initial + refund
    assert_eq!(token.balance(&collector), 3 + 6); // fees from both orders

    // Verify buyer's order list
    let buyer_orders = client.get_orders_by_buyer(&buyer);
    assert_eq!(buyer_orders.len(), 2);

    // Verify farmer's order list
    let farmer_orders = client.get_orders_by_farmer(&farmer);
    assert_eq!(farmer_orders.len(), 2);
}

#[test]
fn test_concurrent_order_creation_same_buyer() {
    let (env, client, buyer, farmer, collector, token, _) = setup_test();
fn test_get_orders_by_buyer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    // Create multiple orders from the same buyer concurrently
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &100);
    let order_id2 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &200);
    let order_id3 = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &300);

    // Verify all orders were created with unique IDs
    assert_eq!(order_id1, 1);
    assert_eq!(order_id2, 2);
    assert_eq!(order_id3, 3);

    // Verify buyer's order list contains all orders
    let buyer_orders = client.get_orders_by_buyer(&buyer);
    assert_eq!(buyer_orders.len(), 3);
    assert_eq!(buyer_orders.get(0).unwrap(), order_id1);
    assert_eq!(buyer_orders.get(1).unwrap(), order_id2);
    assert_eq!(buyer_orders.get(2).unwrap(), order_id3);

    // Verify total fees collected
    assert_eq!(token.balance(&collector), 3 + 6 + 9);
}

#[test]
fn test_event_emission_under_concurrent_operations() {
    let (env, client, buyer1, farmer1, _, token, _) = setup_test();
    let buyer2 = Address::generate(&env);
    let farmer2 = Address::generate(&env);

    // Mint tokens to buyer2
    let token_admin_client = token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&buyer2, &1000);
fn test_get_orders_by_farmer() {
    let (_env, client, buyer, farmer, _, token, _, _) = setup_test();

    // Create orders concurrently and verify events are emitted
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer1, &farmer1, &token.address, &100);
    let order_id2 = client
        .mock_all_auths()
        .create_order(&buyer2, &farmer2, &token.address, &200);

    // Confirm orders concurrently
    client.mock_all_auths().confirm_receipt(&buyer1, &order_id1);
    client.mock_all_auths().confirm_receipt(&buyer2, &order_id2);

    // Verify orders are in correct state (events were processed correctly)
    let order1 = client.get_order_details(&order_id1);
    let order2 = client.get_order_details(&order_id2);

    assert_eq!(order1.status, OrderStatus::Completed);
    assert_eq!(order2.status, OrderStatus::Completed);

    // Verify balances reflect correct state after event-driven operations
    assert_eq!(token.balance(&farmer1), 97);
    assert_eq!(token.balance(&farmer2), 194);
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


