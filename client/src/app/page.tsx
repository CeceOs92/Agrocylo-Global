import Link from "next/link";
import {
  Container,
  Button,
  Card,
  CardContent,
  Badge,
  Text,
} from "@/components/ui";

const features = [
  {
    title: "On-chain escrow",
    description:
      "Buyer funds are locked in a Soroban smart contract until delivery is confirmed. Neither side can be cheated.",
  },
  {
    title: "Direct trade",
    description:
      "Farmers sell to buyers without middlemen. Both sides keep more value at every step.",
  },
  {
    title: "Real-time tracking",
    description:
      "Order status, payment receipts, and dispute resolution happen on-chain — visible to everyone involved.",
  },
];

const flow = [
  {
    step: "01",
    title: "Connect your Stellar wallet",
    description: "Sign in with Freighter — no email, no password, no custodian.",
  },
  {
    step: "02",
    title: "Browse the market or list produce",
    description:
      "Buyers shop verified farmer listings. Farmers create their dashboard in under a minute.",
  },
  {
    step: "03",
    title: "Pay into escrow",
    description:
      "Funds lock on Stellar. The farmer sees the order; the buyer sees the receipt.",
  },
  {
    step: "04",
    title: "Confirm delivery, release payment",
    description:
      "Buyer confirms → funds release to the farmer. Disputes go to the on-chain mediation flow.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="py-16 sm:py-24 lg:py-32">
        <Container size="lg" className="text-center">
          <Badge variant="primary" className="mb-6">
            Agro-DeFi · Built on Stellar
          </Badge>
          <Text variant="h1" as="h1" className="mb-6">
            Fair trade between farmers and buyers — secured by escrow
          </Text>
          <Text variant="body" muted className="max-w-2xl mx-auto mb-10 text-lg">
            AgroCylo lets farmers sell produce directly to buyers, with payments
            held in a Soroban smart contract until both sides confirm. No middlemen,
            no chargebacks, no platform lock-in.
          </Text>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/onboarding">
              <Button variant="primary" size="lg">
                Get started
              </Button>
            </Link>
            <Link href="/market">
              <Button variant="outline" size="lg">
                Browse the market
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-16 border-t border-border">
        <Container size="lg">
          <div className="text-center mb-12">
            <Text variant="h2" as="h2" className="mb-3">
              Why AgroCylo?
            </Text>
            <Text variant="body" muted className="max-w-xl mx-auto">
              Everything that makes peer-to-peer agricultural trade safer for
              both sides.
            </Text>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature) => (
              <Card key={feature.title} variant="outlined" padding="lg">
                <CardContent>
                  <Text variant="h4" as="h3" className="mb-2">
                    {feature.title}
                  </Text>
                  <Text variant="body" muted>
                    {feature.description}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-16 border-t border-border">
        <Container size="lg">
          <div className="text-center mb-12">
            <Text variant="h2" as="h2" className="mb-3">
              How it works
            </Text>
            <Text variant="body" muted className="max-w-xl mx-auto">
              Four steps from listing to settlement.
            </Text>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {flow.map((item) => (
              <Card key={item.step} variant="elevated" padding="lg">
                <CardContent>
                  <Text variant="caption" muted className="font-mono mb-2">
                    {item.step}
                  </Text>
                  <Text variant="h4" as="h3" className="mb-2">
                    {item.title}
                  </Text>
                  <Text variant="body" muted>
                    {item.description}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 border-t border-border">
        <Container size="md" className="text-center">
          <Text variant="h2" as="h2" className="mb-4">
            Ready to trade on your terms?
          </Text>
          <Text variant="body" muted className="mb-8">
            Onboarding takes a minute. Bring a Freighter wallet — that&apos;s it.
          </Text>
          <Link href="/onboarding">
            <Button variant="primary" size="lg">
              Get started
            </Button>
          </Link>
        </Container>
      </section>
    </main>
  );
}
