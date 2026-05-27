import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-3">
          🌾 Agro Production
        </h1>
        <p className="text-muted text-lg max-w-xl">
          Fund agricultural campaigns, buy produce directly from farmers, and earn
          on-chain returns — all powered by Stellar smart contracts.
        </p>
      </div>
      <nav aria-label="Quick actions" className="flex flex-wrap gap-4 justify-center">
        <Link href="/marketplace" className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors" aria-label="Browse marketplace">Browse Marketplace</Link>
        <Link href="/campaigns" className="border border-border text-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-surface transition-colors" aria-label="View campaigns">View Campaigns</Link>
        <Link href="/dashboard" className="border border-border text-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-surface transition-colors" aria-label="View dashboard">My Dashboard</Link>
      </nav>
    </div>
  );
}
