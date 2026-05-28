"use client";

import { useEffect, useState } from "react";
import { Upload, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type {
  Product,
  ProductCategory,
  ProductCurrency,
  ProductUnit,
} from "@/types/product";
import {
  normalizeProductWriteInput,
  createProduct,
  updateProduct,
  uploadProductImage,
} from "@/services/productService";
import { isTestMode } from "@/lib/testMode";

type Mode = "add" | "edit";

type FormErrors = Partial<
  Record<
    | "name"
    | "category"
    | "pricePerUnit"
    | "currency"
    | "unit"
    | "description"
    | "location"
    | "deliveryWindow",
    string
  >
>;

const CATEGORIES: ProductCategory[] = [
  "Vegetables",
  "Fruits",
  "Grains",
  "Tubers",
  "Livestock",
  "Other",
];
const CURRENCIES: ProductCurrency[] = ["STRK", "USDC"];
const UNITS: ProductUnit[] = ["kg", "bag", "crate", "piece", "litre", "dozen"];
const MAX_IMAGES = 8;

const SELECT_CLASSES =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

interface ProductFormModalProps {
  open: boolean;
  mode: Mode;
  walletAddress: string;
  initialProduct?: Product | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function ProductFormModal({
  open,
  mode,
  walletAddress,
  initialProduct,
  onClose,
  onSuccess,
}: ProductFormModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [currency, setCurrency] = useState<ProductCurrency>("STRK");
  const [unit, setUnit] = useState<ProductUnit>("kg");
  const [stockQuantity, setStockQuantity] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [location, setLocation] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form when reopening / switching products
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaveError(null);
    setName(initialProduct?.name ?? "");
    setCategory(initialProduct?.category ?? null);
    setPricePerUnit(initialProduct?.price_per_unit ?? "");
    setCurrency((initialProduct?.currency as ProductCurrency) ?? "STRK");
    setUnit((initialProduct?.unit as ProductUnit) ?? "kg");
    setStockQuantity(initialProduct?.stock_quantity ?? "");
    setDescription(initialProduct?.description ?? "");
    setLocation(initialProduct?.location ?? "");
    setDeliveryWindow(initialProduct?.delivery_window ?? "");
    setIsAvailable(initialProduct?.is_available ?? true);
    setImageFiles([]);
  }, [open, initialProduct]);

  function handleFileChange(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files);
    if (imageFiles.length + next.length > MAX_IMAGES) {
      setSaveError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }
    setImageFiles((prev) => [...prev, ...next]);
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Product name is required.";
    if (!category) next.category = "Select a category.";
    if (!pricePerUnit || Number(pricePerUnit) <= 0)
      next.pricePerUnit = "Invalid price.";
    // In test mode location and deliveryWindow are optional
    if (!isTestMode()) {
      if (!location.trim()) next.location = "Location is required.";
      if (!deliveryWindow.trim())
        next.deliveryWindow = "Delivery window is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = normalizeProductWriteInput({
        name: name.trim(),
        category,
        pricePerUnit,
        currency,
        unit,
        stockQuantity,
        description,
        isAvailable,
        location,
        deliveryWindow,
      });

      const product =
        mode === "add"
          ? await createProduct(walletAddress, payload)
          : await updateProduct(walletAddress, initialProduct!.id, payload);

      if (imageFiles.length > 0) {
        await Promise.all(
          imageFiles.map((file) =>
            uploadProductImage(walletAddress, product.id, file),
          ),
        );
      }

      await onSuccess();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add Product" : "Edit Listing"}
          </DialogTitle>
          <DialogDescription>
            Listings on AgroCylo can be priced in STRK or USDC and are
            settled by the Soroban escrow when a buyer confirms receipt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Product Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <select
                className={SELECT_CLASSES}
                value={category ?? ""}
                onChange={(e) =>
                  setCategory((e.target.value || null) as ProductCategory)
                }
              >
                <option value="" disabled>
                  Select category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-destructive text-xs">{errors.category}</p>
              )}
            </div>
          </div>

          {/* Pricing & units */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Price"
              type="number"
              min={0}
              step={0.01}
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              error={errors.pricePerUnit}
              required
            />
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <select
                className={SELECT_CLASSES}
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as ProductCurrency)
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <select
                className={SELECT_CLASSES}
                value={unit}
                onChange={(e) => setUnit(e.target.value as ProductUnit)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock + availability */}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr] sm:items-end">
            <Input
              label="Stock quantity"
              hint="Leave blank for unlimited."
              type="number"
              min={0}
              step={1}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
            <div className="bg-secondary/40 flex h-12 items-center justify-between gap-3 rounded-md border px-4">
              <Label htmlFor="prod-available" className="cursor-pointer">
                Listed
              </Label>
              <Switch
                id="prod-available"
                checked={isAvailable}
                onCheckedChange={setIsAvailable}
              />
            </div>
          </div>

          {/* Logistics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Farm Location (Region)"
              placeholder="e.g. Kumasi, Ghana"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              error={errors.location}
              required
            />
            <Input
              label="Delivery Window"
              placeholder="e.g. 2-3 days"
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              error={errors.deliveryWindow}
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="prod-description">
              Description &amp; Health Benefits
            </Label>
            <Textarea
              id="prod-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell buyers about origin, organic status, or health benefits..."
            />
          </div>

          {/* Images */}
          <div className="grid gap-2">
            <Label>Product images</Label>
            <p className="text-muted-foreground text-xs">
              Up to {MAX_IMAGES} images. First image is the cover.
            </p>
            <label
              htmlFor="prod-image-upload"
              className="bg-secondary/40 hover:bg-secondary border-border hover:border-primary/40 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
            >
              <div className="bg-background grid size-10 place-content-center rounded-full border">
                <Upload className="text-muted-foreground size-4" />
              </div>
              <p className="text-sm font-medium">Click or drop images here</p>
              <p className="text-muted-foreground text-xs">
                PNG / JPG / WEBP · up to 2 MB each
              </p>
              <input
                id="prod-image-upload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files)}
              />
            </label>

            {imageFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {imageFiles.map((f, i) => (
                  <span
                    key={i}
                    className="bg-secondary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                  >
                    {f.name}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setImageFiles((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {saveError && (
            <div className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg border p-3 text-sm">
              {saveError}
            </div>
          )}

          <Separator />

          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} disabled={saving}>
              {mode === "add" ? "List Product" : "Update Listing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
