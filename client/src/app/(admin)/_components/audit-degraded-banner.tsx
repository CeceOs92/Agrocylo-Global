"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { isAuditLoggingDegraded } from "@/services/adminService";

/**
 * Shows a persistent banner in the admin UI when the server-side audit
 * endpoint is unreachable. Polls every 30s to detect recovery.
 */
export function AuditDegradedBanner() {
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const check = () => setDegraded(isAuditLoggingDegraded());
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!degraded) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2 border-b border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        <strong>Audit logging unavailable.</strong>{" "}
        Server-side audit endpoint is unreachable. Admin actions may not be
        recorded until connectivity is restored.
      </span>
    </div>
  );
}
