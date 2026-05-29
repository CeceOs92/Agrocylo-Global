import Image from "next/image";
import Wrapper from "@/components/shared/wrapper";
import { siteConfig } from "@/config/site.config";

const benefits = [
  {
    title: "Secure Transactions.",
    description:
      "Payments are held in a Soroban escrow contract until delivery is confirmed, ensuring trust for both buyers and farmers.",
  },
  {
    title: "Low Fees.",
    description:
      "Stellar settles trades for fractions of a cent, plus a flat 3% platform fee — keeping more value in farmers' hands.",
  },
  {
    title: "Decentralized & Transparent.",
    description:
      "Built on Stellar for fast, low-cost, and verifiable transactions without intermediaries.",
  },
  {
    title: "Easy Order Management.",
    description:
      "Place, confirm, refund, or dispute orders seamlessly through our smart-contract flow.",
  },
];

export default function WhyChooseUs() {
  return (
    <section id="why-choose-us" className="mb-16 md:mb-40">
      <Wrapper className="space-y-12">
        <div className="w-full">
          <h2 className="text-foreground max-w-[672px] text-2xl leading-none font-semibold sm:text-3xl md:text-4xl lg:text-[40px]">
            Why Choose {siteConfig.title}?
          </h2>
          <p className="text-muted-foreground mt-4 max-w-[672px] text-base font-normal md:text-lg lg:leading-[1.5]">
            Our decentralized platform provides unmatched benefits for both
            farmers and buyers.
          </p>
        </div>

        <div className="lg:flex lg:items-center lg:justify-end">
          <div className="flex justify-center lg:w-1/2 lg:justify-end lg:pr-12">
            <div className="w-full flex-none md:w-[33.75rem] lg:w-[45rem]">
              <Image
                src="/images/market-hero.avif"
                alt="A farmer holding fresh produce"
                width={2400}
                height={3000}
                priority
                quality={100}
                className="aspect-[655/680] w-full rounded-[50px] object-cover object-center"
              />
            </div>
          </div>

          <ul
            role="list"
            className="text-muted-foreground mt-16 text-base lg:mt-0 lg:w-1/2 lg:min-w-[33rem] lg:pl-4"
          >
            {benefits.map((benefit, index) => (
              <li key={index} className="group mt-10 first:mt-0">
                <div className="after:bg-border before:bg-foreground relative pt-10 group-first:pt-0 before:absolute before:left-0 before:top-0 before:h-px before:w-6 group-first:before:hidden after:absolute after:left-8 after:right-0 after:top-0 after:h-px group-first:after:hidden">
                  <strong className="text-foreground font-semibold">
                    {benefit.title}{" "}
                  </strong>
                  {benefit.description}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Wrapper>
    </section>
  );
}
