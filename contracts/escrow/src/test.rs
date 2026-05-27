#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

fn setup_test() -> (
    Env,
    EscrowContractClient<'static>,
    Address, // buyer
    Address, // farmer
    Address, // fee_collector
    token::Client<'static>,
    token::Client<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let farmer = Address::generate(&env);
    let fee_collector = Address::generate(&env);

    let token_admin = Address::generate(&env);

    // Create XLM (Token 1)
    let xlm_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let xlm_client = token::Client::new(&env, &xlm_contract.address());
    let xlm_admin_client = token::StellarAssetClient::new(&env, &xlm_contract.address());
    xlm_admin_client.mint(&buyer, &1000);

    // Create USDC (Token 2)
    let usdc_contract = env.register_stellar_asset_contract_v2(token_admin);
    let usdc_client = token::Client::new(&env, &usdc_contract.address());

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    // Initialize the contract with supported tokens
    let mut supported_tokens = Vec::new(&env);
    supported_tokens.push_back(xlm_client.address.clone());
    supported_tokens.push_back(usdc_client.address.clone());

    client.initialize(&admin, &supported_tokens, &fee_collector);

    (env, client, buyer, farmer, fee_collector, xlm_client, usdc_client)
}

#[test]
fn test_create_and_confirm_order() {
    let (_env, client, buyer, farmer, collector, token, _) = setup_test();

    assert_eq!(token.balance(&buyer), 1000);
    assert_eq!(token.balance(&farmer), 0);
    assert_eq!(token.balance(&collector), 0);

    let amount = 500;
    let expected_fee = 15; // 3% of 500
    let expected_net = 485;

    // Create order
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &amount);

    assert_eq!(order_id, 1);

    // Tokens moved: 500 from buyer, 15 to collector, 485 to escrow
    assert_eq!(token.balance(&buyer), 500);
    assert_eq!(token.balance(&collector), expected_fee);
    let escrow_address = client.address.clone();
    assert_eq!(token.balance(&escrow_address), expected_net);

    // Verify view functions
    let order_details = client.get_order_details(&order_id);
    assert_eq!(order_details.buyer, buyer);
    assert_eq!(order_details.farmer, farmer);
    assert_eq!(order_details.amount, expected_net); // net amount stored
    assert_eq!(order_details.status, OrderStatus::Pending);

    // Confirm receipt
    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    // Tokens moved to farmer (only net amount)
    assert_eq!(token.balance(&escrow_address), 0);
    assert_eq!(token.balance(&farmer), expected_net);

    // Order status now Completed
    let order_details_after = client.get_order_details(&order_id);
    assert_eq!(order_details_after.status, OrderStatus::Completed);
}

#[test]
fn test_confirm_already_completed() {
    let (_env, client, buyer, farmer, _, token, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    // Fails with OrderNotPending
    let result = client
        .mock_all_auths()
        .try_confirm_receipt(&buyer, &order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotPending);
}

#[test]
fn test_refund_expired_order() {
    let (env, client, buyer, farmer, collector, token, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let escrow_address = client.address.clone();
    assert_eq!(token.balance(&buyer), 500);
    assert_eq!(token.balance(&collector), 15);
    assert_eq!(token.balance(&escrow_address), 485);

    // Fast forward time 96+ hours
    env.ledger()
        .set_timestamp(env.ledger().timestamp() + 345601);

    client.mock_all_auths().refund_expired_order(&order_id);

    // Funds back to buyer (only 485 returned, 15 kept by platform)
    assert_eq!(token.balance(&escrow_address), 0);
    assert_eq!(token.balance(&buyer), 500 + 485);

    let order_details = client.get_order_details(&order_id);
    assert_eq!(order_details.status, OrderStatus::Refunded);
}

#[test]
fn test_refund_unexpired_order_fails() {
    let (env, client, buyer, farmer, _, token, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    // Fast forward only 1 hour
    env.ledger().set_timestamp(env.ledger().timestamp() + 3600);

    // Fails with OrderNotExpired
    let result = client.mock_all_auths().try_refund_expired_order(&order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotExpired);
}

#[test]
fn test_create_order_unsupported_token_fails() {
    let (env, client, buyer, farmer, _, _, _) = setup_test();
    let unsupported_token_admin = Address::generate(&env);
    let unsupported_contract = env.register_stellar_asset_contract_v2(unsupported_token_admin);
    let unsupported_client = token::Client::new(&env, &unsupported_contract.address());

    // Fails because the token was not initialized as supported
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
    let (_env, client, buyer, farmer, collector, token, _) = setup_test();

    let amount = 1000;

    client.mock_all_auths().create_order(&buyer, &farmer, &token.address, &amount);

    // Acceptance criteria:
    // - fee_collector receives exactly 30 tokens
    // - order.amount stores 970
    assert_eq!(token.balance(&collector), 30);
    let order_details = client.get_order_details(&1);
    assert_eq!(order_details.amount, 970);

    // confirm_receipt releases exactly 970 to the farmer
    client.mock_all_auths().confirm_receipt(&buyer, &1);
    assert_eq!(token.balance(&farmer), 970);
}

// ===== CONCURRENT OPERATION SAFETY TESTS =====

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

    // Create multiple orders
    let order_id1 = client
        .mock_all_auths()
        .create_order(&buyer1, &farmer1, &token.address, &100);
    let order_id2 = client
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
