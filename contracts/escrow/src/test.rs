#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    token, Address, Env,
};

fn setup_test() -> (
    Env,
    EscrowContractClient<'static>,
    Address,
    Address,
    token::Client<'static>,
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

    let usdc_contract = env.register_stellar_asset_contract_v2(token_admin);
    let usdc_client = token::Client::new(&env, &usdc_contract.address());

    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(&env, &contract_id);

    let mut supported_tokens = Vec::new(&env);
    supported_tokens.push_back(xlm_client.address.clone());
    supported_tokens.push_back(usdc_client.address.clone());

    client.initialize(&admin, &supported_tokens);

    (env, client, buyer, farmer, xlm_client, usdc_client)
}

#[test]
fn test_create_and_confirm_order() {
    let (_env, client, buyer, farmer, token, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    assert_eq!(order_id, 1);

    let order_details = client.get_order_details(&order_id);
    assert_eq!(order_details.status, OrderStatus::Pending);
    assert_eq!(order_details.delivery_timestamp, None);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let order_after = client.get_order_details(&order_id);
    assert_eq!(order_after.status, OrderStatus::Completed);
    assert_eq!(token.balance(&farmer), 500);
}

#[test]
fn test_basic_escrow_happy_path_tracks_state_balances_and_events() {
    let (env, client, buyer, farmer, token, _) = setup_test();
    let contract_address = client.address.clone();

    let initial_event_count = env.events().all().len();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    let order = client.get_order_details(&order_id);
    assert_eq!(order_id, 1);
    assert_eq!(order.status, OrderStatus::Pending);
    assert_eq!(order.buyer, buyer);
    assert_eq!(order.farmer, farmer);
    assert_eq!(token.balance(&buyer), 500);
    assert_eq!(token.balance(&contract_address), 500);
    assert!(env.events().all().len() > initial_event_count);

    client.mock_all_auths().mark_delivered(&farmer, &order_id);
    let delivered = client.get_order_details(&order_id);
    assert_eq!(delivered.status, OrderStatus::Delivered);
    assert!(delivered.delivery_timestamp.is_some());
    assert_eq!(token.balance(&contract_address), 500);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);
    let completed = client.get_order_details(&order_id);
    assert_eq!(completed.status, OrderStatus::Completed);
    assert_eq!(token.balance(&contract_address), 0);
    assert_eq!(token.balance(&farmer), 500);
    assert!(env.events().all().len() >= initial_event_count + 3);
}

#[test]
fn test_mark_delivered_then_confirm() {
    let (_env, client, buyer, farmer, token, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().mark_delivered(&farmer, &order_id);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Delivered);
    assert!(order.delivery_timestamp.is_some());

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let order_after = client.get_order_details(&order_id);
    assert_eq!(order_after.status, OrderStatus::Completed);
    assert_eq!(token.balance(&farmer), 500);
}

#[test]
fn test_mark_delivered_wrong_farmer_fails() {
    let (env, client, buyer, farmer, token, _) = setup_test();
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
    let (_env, client, buyer, farmer, token, _) = setup_test();

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
    let (_env, client, buyer, farmer, token, _) = setup_test();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    client.mock_all_auths().confirm_receipt(&buyer, &order_id);

    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Completed);
}

#[test]
fn test_confirm_already_completed() {
    let (_env, client, buyer, farmer, token, _) = setup_test();
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
    let (env, client, buyer, farmer, token, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    env.ledger().set_timestamp(env.ledger().timestamp() + 345601);

    client.mock_all_auths().refund_expired_order(&order_id);

    assert_eq!(token.balance(&buyer), 1000);
    let order = client.get_order_details(&order_id);
    assert_eq!(order.status, OrderStatus::Refunded);
}

#[test]
fn test_basic_escrow_expiration_refund_tracks_state_balances_and_events() {
    let (env, client, buyer, farmer, token, _) = setup_test();
    let contract_address = client.address.clone();
    let initial_event_count = env.events().all().len();

    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &400);

    assert_eq!(token.balance(&buyer), 600);
    assert_eq!(token.balance(&contract_address), 400);

    env.ledger().set_timestamp(env.ledger().timestamp() + 345601);
    client.mock_all_auths().refund_expired_order(&order_id);

    let refunded = client.get_order_details(&order_id);
    assert_eq!(refunded.status, OrderStatus::Refunded);
    assert_eq!(token.balance(&buyer), 1000);
    assert_eq!(token.balance(&contract_address), 0);
    assert_eq!(token.balance(&farmer), 0);
    assert!(env.events().all().len() >= initial_event_count + 2);
}

#[test]
fn test_refund_unexpired_order_fails() {
    let (env, client, buyer, farmer, token, _) = setup_test();
    let order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &500);

    env.ledger().set_timestamp(env.ledger().timestamp() + 3600);

    let result = client.mock_all_auths().try_refund_expired_order(&order_id);
    assert_eq!(result.unwrap_err().unwrap(), EscrowError::OrderNotExpired);
}

#[test]
fn test_multiple_orders_for_same_farmer_complete_independently() {
    let (_env, client, buyer, farmer, token, _) = setup_test();

    let first_order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &250);
    let second_order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &300);

    let farmer_orders = client.get_orders_by_farmer(&farmer);
    let buyer_orders = client.get_orders_by_buyer(&buyer);
    assert_eq!(farmer_orders.len(), 2);
    assert_eq!(buyer_orders.len(), 2);
    assert_eq!(token.balance(&buyer), 450);

    client
        .mock_all_auths()
        .mark_delivered(&farmer, &first_order_id);
    client.mock_all_auths().confirm_receipt(&buyer, &first_order_id);

    assert_eq!(client.get_order_details(&first_order_id).status, OrderStatus::Completed);
    assert_eq!(client.get_order_details(&second_order_id).status, OrderStatus::Pending);
    assert_eq!(token.balance(&farmer), 250);
}

#[test]
fn test_batch_refund_expired_orders() {
    let (env, client, buyer, farmer, token, _) = setup_test();
    let contract_address = client.address.clone();

    let first_order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &200);
    let second_order_id = client
        .mock_all_auths()
        .create_order(&buyer, &farmer, &token.address, &300);

    assert_eq!(token.balance(&buyer), 500);
    assert_eq!(token.balance(&contract_address), 500);

    env.ledger().set_timestamp(env.ledger().timestamp() + 345601);
    let mut order_ids = Vec::new(&env);
    order_ids.push_back(first_order_id);
    order_ids.push_back(second_order_id);
    client.mock_all_auths().refund_expired_orders(&order_ids);

    assert_eq!(client.get_order_details(&first_order_id).status, OrderStatus::Refunded);
    assert_eq!(client.get_order_details(&second_order_id).status, OrderStatus::Refunded);
    assert_eq!(token.balance(&buyer), 1000);
    assert_eq!(token.balance(&contract_address), 0);
}

#[test]
fn test_create_order_unsupported_token_fails() {
    let (env, client, buyer, farmer, _, _) = setup_test();
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
