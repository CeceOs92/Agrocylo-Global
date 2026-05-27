"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EvidenceFile {
  name: string;
  size: number;
  previewUrl: string | null;
  hash: string;
}

interface EvidenceUploadProps {
  onChange: (file: EvidenceFile | null) => void;
  disabled?: boolean;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function EvidenceUpload({
  onChange,
  disabled,
}: EvidenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [evidence, setEvidence] = useState<EvidenceFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError("File exceeds 10 MB limit.");
        return;
      }
      setHashing(true);
      try {
        const hash = await sha256(file);
        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null;
        const ev: EvidenceFile = {
          name: file.name,
          size: file.size,
          previewUrl,
          hash,
        };
        setEvidence(ev);
        onChange(ev);
      } catch {
        setError("Failed to process file.");
      } finally {
        setHashing(false);
      }
    },
    [onChange],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleRemove = () => {
    if (evidence?.previewUrl) URL.revokeObjectURL(evidence.previewUrl);
    setEvidence(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const interactable = !disabled && !hashing;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handleChange}
        disabled={!interactable}
      />

      {!evidence ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => interactable && inputRef.current?.click()}
          className={cn(
            "bg-secondary/40 hover:bg-secondary flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border",
            !interactable && "cursor-not-allowed opacity-60",
          )}
        >
          <div className="bg-background grid size-10 place-content-center rounded-full border">
            <Upload className="text-muted-foreground size-4" />
          </div>
          <p className="text-sm font-medium">
            {hashing ? "Generating hash…" : "Drag & drop or click to upload"}
          </p>
          <p className="text-muted-foreground text-xs">
            JPG, PNG, WEBP, GIF, PDF · max 10 MB
          </p>
        </div>
      ) : (
        <div className="bg-card space-y-3 rounded-2xl border p-3">
          {evidence.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={evidence.previewUrl}
              alt="evidence preview"
              className="bg-secondary max-h-48 w-full rounded-xl object-contain"
            />
          ) : (
            <div className="bg-secondary flex items-center gap-3 rounded-xl p-4">
              <FileText className="text-muted-foreground size-6" />
              <span className="text-sm font-medium">PDF document</span>
            </div>
          )}

          <div className="space-y-0.5 text-xs">
            <p className="truncate font-medium">{evidence.name}</p>
            <p className="text-muted-foreground">
              {(evidence.size / 1024).toFixed(1)} KB
            </p>
            <p className="text-muted-foreground/80 font-mono break-all">
              SHA-256: {evidence.hash}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="size-3.5" />
            Remove
          </Button>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
