import type { Product, ProductListResponse, ProductCategory } from "@/types";
import api from "../lib/apiClient";

export interface ProductFilters {
  category?: ProductCategory;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: number;
  limit?: number;
}

export async function fetchProducts(
  filters: ProductFilters = {},
): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  if (filters.category) query.set("category", filters.category);
  if (filters.location) query.set("location", filters.location);
  if (filters.minPrice) query.set("minPrice", filters.minPrice);
  if (filters.maxPrice) query.set("maxPrice", filters.maxPrice);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.limit) query.set("limit", String(filters.limit));

  return api.get<ProductListResponse>(`/products?${query}`);
}

export async function fetchProduct(id: string): Promise<Product> {
  return api.get<Product>(`/products/${id}`);
}

export function formatPrice(raw: string): string {
  const n = BigInt(raw || "0");
  const xlm = Number(n) / 1e7;
  return xlm.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
