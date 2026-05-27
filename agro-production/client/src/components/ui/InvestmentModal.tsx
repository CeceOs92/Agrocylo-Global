import { useState, useEffect, useCallback, useRef } from 'react';
import { useInvest } from '@/hooks/useInvest';
import { validateAmount } from '@/lib/validation';
import { ButtonSpinner } from '@/components/Skeletons';

interface InvestmentModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
}

export default function InvestmentModal({ open, onClose, productId }: InvestmentModalProps) {
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const { invest, loading, error, success } = useInvest();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function handleAmountChange(raw: string) {
    setAmount(raw);
    if (!raw) {
      setAmountError(null);
      return;
    }
    const result = validateAmount(raw, 0);
    setAmountError(result.valid ? null : result.error);
  }

  const isFormValid = !!amount && !amountError && validateAmount(amount, 0).valid;

  const handleInvest = async () => {
    const result = validateAmount(amount, 0);
    if (!result.valid) {
      setAmountError(result.error);
      return;
    }
    setAmountError(null);
    const value = Number(result.sanitized);
    if (!value || value <= 0) return;
    await invest(productId, value);
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onClose();
        setAmount('');
        setAmountError(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !loading) {
      onClose();
    }
    if (e.key === "Tab" && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  }, [loading, onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      closeRef.current?.focus();
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Invest in product"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div ref={modalRef} className="bg-background text-foreground p-6 rounded-lg shadow-xl max-w-sm w-full">
        <h2 className="text-xl font-semibold mb-4 text-primary-600">
          Invest in product
        </h2>
        <div>
          <label htmlFor="invest-amount" className="block text-sm font-medium text-foreground mb-1">
            Amount (XLM)
          </label>
          <input
            id="invest-amount"
            type="number"
            min="1"
            placeholder="Amount"
            value={amount}
            onChange={e => handleAmountChange(e.target.value)}
            aria-invalid={!!amountError}
            aria-describedby={amountError ? "invest-amount-error" : undefined}
            className={`w-full p-2 border rounded mb-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 ${amountError ? "border-red-400 focus:ring-red-400" : "border-border"}`}
          />
          {amountError && (
            <p id="invest-amount-error" className="text-xs text-error mb-2" role="alert">{amountError}</p>
          )}
        </div>
        <button
          onClick={handleInvest}
          disabled={loading || !isFormValid}
          aria-label={loading ? "Processing investment" : !isFormValid ? "Enter a valid amount to invest" : "Invest"}
          className="w-full py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading && <ButtonSpinner />}
          {loading ? 'Investing…' : 'Invest'}
        </button>
        {error && (
          <p className="mt-2 text-sm text-error" role="alert">{error}</p>
        )}
        {success && (
          <p className="mt-2 text-sm text-success" role="status">Investment successful!</p>
        )}
        <button
          ref={closeRef}
          onClick={onClose}
          disabled={loading}
          className="mt-4 text-sm underline text-primary-600"
          aria-label="Cancel investment"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
