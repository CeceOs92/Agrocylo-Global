/**
 * @deprecated Import from `./stellarTransactions` instead.
 *
 * Back-compat re-export. The transaction sign/submit/poll pipeline was
 * consolidated into a single module (issue #809); this file now only forwards
 * to it so existing imports keep working.
 */
export * from "./stellarTransactions";
