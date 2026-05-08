"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { queryKeys } from "@/lib/queryKeys";
import {
  getActiveCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} from "@/services/cartService";

/** Active cart for the connected wallet. */
export function useActiveCart() {
  const { address, connected } = useWallet();
  return useQuery({
    queryKey: queryKeys.cart.all(),
    queryFn: () => getActiveCart(address!),
    enabled: connected && !!address,
  });
}

export function useAddCartItem() {
  const { address } = useWallet();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number }) =>
      addItemToCart(address!, input.productId, input.quantity),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart.all(), cart),
  });
}

export function useUpdateCartItem() {
  const { address } = useWallet();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; quantity: number }) =>
      updateCartItemQuantity(address!, input.itemId, input.quantity),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart.all(), cart),
  });
}

export function useRemoveCartItem() {
  const { address } = useWallet();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeCartItem(address!, itemId),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart.all(), cart),
  });
}

export function useClearCart() {
  const { address } = useWallet();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clearCart(address!),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart.all(), cart),
  });
}
