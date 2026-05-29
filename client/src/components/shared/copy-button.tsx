"use client";

import { cn } from "@/lib/utils";
import { CheckCheck } from "lucide-react";
import { IoCopyOutline } from "react-icons/io5";
import { useEffect, useState } from "react";
import type { FC, ReactNode } from "react";

interface CopyButtonProps {
  text: string | undefined;
  children?: ReactNode;
  className?: string;
  iconClassName?: string;
}

const CopyButton: FC<CopyButtonProps> = ({
  text,
  children,
  iconClassName,
  className = "flex items-center gap-2",
}) => {
  const [isCopied, setIsCopied] = useState(false);

  function handleFallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const successful = document.execCommand("copy");
      setIsCopied(successful);
    } catch (error) {
      console.error("Fallback: Oops, unable to copy", error);
    }
    document.body.removeChild(textarea);
  }

  function handleCopyClick() {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => setIsCopied(true))
        .catch((err) => console.log(err));
    } else {
      handleFallbackCopy(text);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      setIsCopied(false);
    }, 1500);

    return () => clearTimeout(id);
  }, [isCopied]);

  const Icon = isCopied ? CheckCheck : IoCopyOutline;

  return (
    <button
      aria-label={isCopied ? "Copied!" : "copy"}
      aria-live="assertive"
      title={isCopied ? "Copied!" : "click to copy address"}
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        e.preventDefault();
        handleCopyClick();
      }}
    >
      {children}
      <Icon aria-hidden className={cn("size-[14px]", iconClassName)} />
    </button>
  );
};

export default CopyButton;
export { CopyButton };
