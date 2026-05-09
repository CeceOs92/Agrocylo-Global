import Link from "next/link";
import Image from "next/image";
import { RiArrowRightUpLine } from "react-icons/ri";

import Wrapper from "@/components/shared/wrapper";
import { Button, buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site.config";

export default function HomeHeroSection() {
  return (
    <div className="relative lg:h-[calc(100dvh-124px)]">
      <div className="absolute inset-0 size-full">
        <Image
          src="/images/home-hero.avif"
          alt="A tractor moving through a field at sunset"
          fill
          className="size-full object-cover object-center"
          quality={100}
          priority
          sizes="100vw"
          unoptimized
          fetchPriority="high"
          draggable={false}
          decoding="async"
        />
      </div>
      <div className="from-background/90 via-background/85 to-background/25 relative bg-gradient-to-r pt-40 pb-20 sm:py-72 lg:h-full">
        <Wrapper>
          <h1 className="text-foreground max-w-[805px] text-3xl leading-[1.3] font-semibold sm:text-4xl md:text-5xl lg:text-[64px]">
            Revolutionizing <span className="text-primary">Agriculture</span>{" "}
            with Stellar Escrow.
          </h1>
          <p className="mt-2 max-w-[700px] text-base font-normal md:text-lg">
            {siteConfig.ogDescription}
          </p>
          <Link
            href="https://stellar.org/"
            target="_blank"
            className="bg-background/80 mt-6 inline-flex items-center gap-3 rounded-full border px-3.5 py-1.5 backdrop-blur-sm"
          >
            <span className="text-[13px] font-medium">Powered by</span>
            <span className="text-[13px] font-bold tracking-wide">Stellar</span>
          </Link>

          <div className="mt-10 flex w-full flex-col gap-4 sm:flex-row sm:gap-6">
            <Link
              href="/market"
              className={buttonVariants({
                size: "lg",
              })}
            >
              <span>Explore Marketplace</span>
            </Link>
            <Link href="/onboarding" className={buttonVariants({ variant: "outline", size: "lg", className: "group" })}>
              <span>Start Trading Now</span>
              <RiArrowRightUpLine className="size-5 transition-all ease-in-out group-hover:rotate-45 sm:!size-6" />
            </Link>
          </div>
        </Wrapper>
      </div>
    </div>
  );
}
