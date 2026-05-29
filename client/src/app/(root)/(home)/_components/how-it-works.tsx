import Wrapper from "@/components/shared/wrapper";
import { siteConfig } from "@/config/site.config";
import { BanknoteArrowUp, Check, ShoppingCart } from "lucide-react";

const howItWorksData = [
  {
    title: "Place an Order with Crypto Confidence",
    description:
      "Buyers browse available farm products, choose what they need, and complete their purchase securely using XLM or USDC. Payments are held in a Soroban escrow contract until delivery is confirmed, protecting both parties.",
    icon: ShoppingCart,
  },
  {
    title: "Confirm Product Delivery & Quality",
    description:
      "Once the buyer receives their goods and verifies product quality, they confirm delivery on the platform. This confirmation automatically triggers the release of funds held in escrow to the farmer, with full on-chain transparency.",
    icon: Check,
  },
  {
    title: "Receive Transparent Payment via Stellar",
    description:
      "Farmers are paid directly through Stellar's fast, low-cost network — settlement in seconds, fees in fractions of a cent. Every transaction is verifiable on-chain, ensuring financial clarity and trustless fulfilment.",
    icon: BanknoteArrowUp,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mb-16 md:mb-60">
      <Wrapper>
        <h2 className="text-foreground max-w-[672px] text-2xl leading-none font-semibold sm:text-3xl md:text-4xl lg:text-[40px]">
          How {siteConfig.title} Works
        </h2>
        <p className="text-muted-foreground mt-4 max-w-[672px] text-base font-normal md:text-lg lg:leading-[1.5]">
          Our platform makes agricultural trading simple, secure, and
          transparent.
        </p>
      </Wrapper>

      <Wrapper
        max2
        className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {howItWorksData.map((item, index) => (
          <div
            key={index}
            className="flex-1 rounded-[50px] bg-[#FCCD29] p-8 shadow-lg transition-all delay-150 duration-300 dark:border dark:border-primary/20 dark:bg-[#1a2e1c] dark:shadow-none md:hover:-translate-y-3 md:hover:scale-105 md:hover:shadow-2xl lg:px-[38px] lg:py-[51px]"
          >
            <div className="bg-canvas-dark mb-4 flex size-[100px] items-center justify-center rounded-full dark:border dark:border-primary/30 dark:bg-primary/20">
              <item.icon className="size-10 text-white dark:text-primary" />
            </div>
            <h3 className="font-display mt-16 mb-8 max-w-[246px] text-lg font-semibold md:text-xl dark:text-foreground">
              {item.title}
            </h3>
            <p className="text-base dark:text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </Wrapper>
    </section>
  );
}
