"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";

import { TransactionFeedbackContext } from "@/context/TransactionFeedbackContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TransactionState } from "@/types/transaction";

export interface TransactionFeedbackPanelProps {
  /** Inline card (stacked with other content) vs modal dialog. */
  variant?: "inline" | "modal";
  isOpen?: boolean;
  onClose?: () => void;
  /** Auto-dismiss success state after N milliseconds. 0 = never. */
  autoDismissMs?: number;
  getTxUrl?: (txHash: string) => string;
  showCopyButton?: boolean;
  showExplorerLink?: boolean;
}

type Tone = "neutral" | "primary" | "warning" | "success" | "destructive";

interface StateConfig {
  label: string;
  tone: Tone;
  badge:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning";
  showSpinner: boolean;
}

const stateConfigs: Record<TransactionState, StateConfig> = {
  idle: {
    label: "Ready",
    tone: "neutral",
    badge: "default",
    showSpinner: false,
  },
  pending: {
    label: "Processing transaction…",
    tone: "primary",
    badge: "default",
    showSpinner: true,
  },
  confirming: {
    label: "Awaiting blockchain confirmation…",
    tone: "warning",
    badge: "warning",
    showSpinner: true,
  },
  success: {
    label: "Transaction confirmed",
    tone: "success",
    badge: "success",
    showSpinner: false,
  },
  failure: {
    label: "Transaction failed",
    tone: "destructive",
    badge: "destructive",
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

export function TransactionFeedbackPanel({
  variant = "inline",
  isOpen = true,
  onClose,
  autoDismissMs = 0,
  getTxUrl,
  showCopyButton = true,
  showExplorerLink = true,
}: TransactionFeedbackPanelProps) {
  const context = useContext(TransactionFeedbackContext);
  const [copied, setCopied] = useState(false);

  const state = context?.feedback?.state ?? "idle";
  const txHash = context?.feedback?.txHash;
  const errorMessage = context?.feedback?.errorMessage;
  const message = context?.feedback?.message;
  const reset = context?.reset;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (state === "success" && autoDismissMs > 0) {
      timer = setTimeout(() => {
        reset?.();
        onClose?.();
      }, autoDismissMs);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state, autoDismissMs, reset, onClose]);

  const handleCopy = useCallback(async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transaction hash:", err);
    }
  }, [txHash]);

  const handleClose = useCallback(() => {
    reset?.();
    onClose?.();
  }, [reset, onClose]);

  if (!context) {
    console.warn(
      "TransactionFeedbackPanel must be used within TransactionFeedbackProvider",
    );
    return null;
  }

  const isTerminal = state === "success" || state === "failure";
  if (!isOpen || state === "idle") return null;

  const cfg = stateConfigs[state];
  const explorerUrl = txHash && getTxUrl ? getTxUrl(txHash) : null;

  const body = (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            "grid size-16 place-content-center rounded-full",
            toneRing[cfg.tone],
          )}
        >
          {cfg.showSpinner ? (
            <Loader2 className="size-8 animate-spin" />
          ) : state === "success" ? (
            <CheckCircle2 className="size-8" />
          ) : (
            <XCircle className="size-8" />
          )}
        </div>
        <h3 className="mt-4 text-lg font-semibold">{cfg.label}</h3>
        <Badge variant={cfg.badge} className="mt-2 capitalize">
          {state}
        </Badge>
        {message && message !== cfg.label && (
          <p className="text-muted-foreground mt-3 max-w-sm text-sm">
            {message}
          </p>
        )}
      </div>

      {errorMessage && (
        <div className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg border p-3 text-sm">
          {errorMessage}
        </div>
      )}

      {txHash && (
        <div className="bg-secondary/50 space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-muted-foreground text-xs">Transaction hash</p>
            <p className="font-mono mt-1 break-all text-xs">{txHash}</p>
          </div>
          <div className="flex gap-2">
            {showCopyButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy Hash
                  </>
                )}
              </Button>
            )}
            {showExplorerLink && explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="size-3.5" />
                  Explorer
                </Button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (variant === "modal") {
    return (
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next && isTerminal) handleClose();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {body}
          {isTerminal && (
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card role="status" aria-live="polite" aria-atomic="true">
      <CardContent className="space-y-5">
        {body}
        {isTerminal && onClose && (
          <Button variant="outline" onClick={handleClose} className="w-full">
            Dismiss
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
