"use client";

import Link from "next/link";
import Image from "next/image";

import Wrapper from "@/components/shared/wrapper";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Separator } from "@/components/ui/separator";
import ConnectWallet from "@/components/shared/connect-wallet";
import { siteConfig } from "@/config/site.config";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

const navItems = [
  { title: "Home", href: "/" },
  { title: "Marketplace", href: "/market" },
  { title: "Map", href: "/map" },
  { title: "Orders", href: "/orders" },
];

export default function Header() {
  const { itemCount, setDrawerOpen } = useCart();

  return (
    <header className="fixed top-0 left-0 z-50 flex h-20 w-full flex-col justify-end bg-background/70 backdrop-blur-3xl transition-colors duration-300 ease-in-out md:h-28">
      <Wrapper
        max2
        className="mt-auto flex items-center justify-between pb-2 md:pb-4"
      >
        <Link
          href="/"
          className="-ml-1 flex w-fit items-center gap-2 md:max-w-[180px] lg:max-w-[240px]"
        >
          <Image
            src="/logo.svg"
            alt={siteConfig.title}
            height={49}
            width={131}
            priority
            quality={100}
            className="!h-[34px] !w-[100px] object-contain dark:hidden sm:!h-[49px] sm:!w-[131px]"
          />
          <Image
            src="/logo-light.svg"
            alt={siteConfig.title}
            height={49}
            width={131}
            priority
            quality={100}
            className="!h-[34px] !w-[100px] hidden object-contain dark:block sm:!h-[49px] sm:!w-[131px]"
          />
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-7 md:flex lg:gap-8 xl:gap-10">
          {navItems.map((item) => (
            <li key={item.title}>
              <Link
                href={item.href}
                className="text-sm font-normal transition-colors hover:text-primary lg:text-lg"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-1 lg:max-w-[280px]">
          <ThemeToggle />
          <Separator orientation="vertical" className="!h-5 mx-1" />
          <ConnectWallet />
          <Separator orientation="vertical" className="!h-5 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open cart"
            className="relative size-9"
          >
            <ShoppingBag className="size-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 grid size-4 place-content-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Button>
        </div>
      </Wrapper>
    </header>
  );
}
