"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchProducts, formatPrice } from "@/services/productService";
import { validateProductFilters, sanitizeString } from "@/lib/validation";
import type { Product, ProductCategory } from "@/types";

const CATEGORIES: { label: string; value: ProductCategory | "" }[] = [
  { label: "All Categories", value: "" },
  { label: "Grains", value: "GRAINS" },
  { label: "Vegetables", value: "VEGETABLES" },
  { label: "Fruits", value: "FRUITS" },
  { label: "Livestock", value: "LIVESTOCK" },
  { label: "Dairy", value: "DAIRY" },
  { label: "Other", value: "OTHER" },
];

function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} className="bg-surface border border-border rounded-xl overflow-hidden hover:border-primary-400 hover:shadow-md transition-all block" aria-label={`View ${product.name} - ${formatPrice(product.pricePerUnit)} XLM per ${product.unit}`}>
      <div className="h-36 bg-neutral-100 flex items-center justify-center text-4xl" role="img" aria-label={product.imageUrl ? `Image of ${product.name}` : `Placeholder for ${product.name}`}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span aria-hidden="true">🌱</span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground leading-tight">{product.name}</h3>
          <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full whitespace-nowrap">{product.category}</span>
        </div>
        <p className="text-sm text-muted line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between text-sm pt-1">
          <span className="font-medium text-foreground">{formatPrice(product.pricePerUnit)} XLM/{product.unit}</span>
          <span className="text-muted text-xs">{product.location}</span>
        </div>
        <p className="text-xs text-muted">{product.quantity} {product.unit}(s) available</p>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filterErrors, setFilterErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const validation = validateProductFilters({ category, location, minPrice, maxPrice });
    if (!validation.valid) {
      setFilterErrors(validation.errors.map(e => e.message));
      setLoading(false);
      return;
    }
    setFilterErrors([]);
    const sanitized = validation.sanitized;
    try {
      const res = await fetchProducts({
        category: sanitized.category || undefined,
        location: sanitized.location || undefined,
        minPrice: sanitized.minPrice || undefined,
        maxPrice: sanitized.maxPrice || undefined,
      });
      setProducts(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category, location, minPrice, maxPrice]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
        <p className="text-muted text-sm mt-1">Buy fresh produce directly from verified farmers.</p>
      </div>
      <section aria-label="Filter products" className="bg-surface border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="filter-category" className="block text-xs font-medium text-muted mb-1">Category</label>
          <select id="filter-category" value={category} onChange={(e) => { setCategory(e.target.value as ProductCategory | ""); setFilterErrors([]); }} className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground">
            {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-location" className="block text-xs font-medium text-muted mb-1">Location</label>
          <input id="filter-location" type="text" value={location} onChange={(e) => setLocation(sanitizeString(e.target.value))} placeholder="e.g. Lagos, Kano" className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground placeholder:text-muted" />
        </div>
        <div>
          <label htmlFor="filter-min-price" className="block text-xs font-medium text-muted mb-1">Min price (XLM)</label>
          <input id="filter-min-price" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} min="0" placeholder="0" aria-invalid={filterErrors.some(e => e.includes("Min"))} className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground placeholder:text-muted" />
        </div>
        <div>
          <label htmlFor="filter-max-price" className="block text-xs font-medium text-muted mb-1">Max price (XLM)</label>
          <input id="filter-max-price" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min="0" placeholder="Any" aria-invalid={filterErrors.some(e => e.includes("Max"))} className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground placeholder:text-muted" />
        </div>
        {filterErrors.length > 0 && (
          <div className="col-span-full" role="alert">
            {filterErrors.map((err, i) => (
              <p key={i} className="text-xs text-error">{err}</p>
            ))}
          </div>
        )}
      </section>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading products">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden animate-pulse" aria-hidden="true">
              <div className="h-36 bg-neutral-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-200 rounded w-full" />
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16" role="alert"><p className="text-red-600 text-sm mb-3">{error}</p><button onClick={() => void load()} className="text-sm text-primary-600 hover:underline">Try again</button></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted"><p className="text-lg mb-1">No products found</p><p className="text-sm">Try adjusting your filters.</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Products list">{products.map((p) => (<ProductCard key={p.id} product={p} />))}</div>
      )}
    </div>
  );
}
