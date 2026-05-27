"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TransactionState =
  | "idle"
  | "preparing"
  | "waiting_signature"
  | "submitting"
  | "confirming"
  | "success"
  | "failed";

export interface TransactionStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: TransactionState;
  txHash?: string;
  errorMessage?: string;
}

type Tone = "neutral" | "primary" | "warning" | "success" | "destructive";

interface StateConfig {
  label: string;
  badge:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning";
  tone: Tone;
  showSpinner: boolean;
}

const stateConfig: Record<Exclude<TransactionState, "idle">, StateConfig> = {
  preparing: {
    label: "Preparing transaction",
    badge: "default",
    tone: "primary",
    showSpinner: true,
  },
  waiting_signature: {
    label: "Waiting for wallet signature",
    badge: "warning",
    tone: "warning",
    showSpinner: true,
  },
  submitting: {
    label: "Submitting transaction",
    badge: "default",
    tone: "primary",
    showSpinner: true,
  },
  confirming: {
    label: "Confirming on network",
    badge: "warning",
    tone: "warning",
    showSpinner: true,
  },
  success: {
    label: "Transaction successful",
    badge: "success",
    tone: "success",
    showSpinner: false,
  },
  failed: {
    label: "Transaction failed",
    badge: "destructive",
    tone: "destructive",
    showSpinner: false,
  },
};

const toneRing: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  destructive: "bg-destructive/10 text-destructive",
};

export function TransactionStatusModal({
  isOpen,
  onClose,
  state,
  txHash,
  errorMessage,
}: TransactionStatusModalProps) {
  if (state === "idle") return null;

  const config = stateConfig[state];
  const isTerminal = state === "success" || state === "failed";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        // Don't allow dismissal while a tx is in flight.
        if (!next && isTerminal) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div
            className={cn(
              "mb-2 grid size-16 place-content-center rounded-full",
              toneRing[config.tone],
            )}
          >
            {config.showSpinner ? (
              <Loader2 className="size-8 animate-spin" />
            ) : state === "success" ? (
              <CheckCircle2 className="size-8" />
            ) : (
              <XCircle className="size-8" />
            )}
          </div>
          <DialogTitle>{config.label}</DialogTitle>
          <DialogDescription className="sr-only">
            {state.replace(/_/g, " ")}
          </DialogDescription>
          <Badge variant={config.badge} className="mt-2 capitalize">
            {state.replace(/_/g, " ")}
          </Badge>
        </DialogHeader>

        {txHash && (
          <div className="bg-secondary/50 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Transaction hash</p>
            <p className="font-mono mt-1 break-all text-xs">{txHash}</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg border p-3 text-sm">
            {errorMessage}
          </div>
        )}

        {isTerminal && (
          <DialogFooter>
            <Button onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TransactionStatusModal;
