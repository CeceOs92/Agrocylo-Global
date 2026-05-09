import Image from "next/image";
import Link from "next/link";
import { RiTwitterXLine } from "react-icons/ri";
import { RxInstagramLogo } from "react-icons/rx";
import { PiLinkedinLogo, PiFacebookLogo } from "react-icons/pi";

import Wrapper from "@/components/shared/wrapper";
import { siteConfig } from "@/config/site.config";
import { Separator } from "@/components/ui/separator";

const footerLinks = {
  routes: [
    {
      title: "Quick Links",
      routes: [
        { label: "Home", path: "/" },
        { label: "Marketplace", path: "/market" },
        { label: "Farmer Map", path: "/map" },
        { label: "Orders", path: "/orders" },
        { label: "Onboarding", path: "/onboarding" },
      ],
    },
    {
      title: "Legal",
      routes: [
        { label: "Terms of Service", path: "/" },
        { label: "Privacy Policy", path: "/" },
        { label: "Cookie Policy", path: "/" },
        { label: "Disclaimers", path: "/" },
      ],
    },
    {
      title: "Contact",
      routes: [
        { label: "About AgroCylo", path: "/" },
        { label: "FAQ", path: "/" },
        { label: "Support", path: "/" },
      ],
    },
  ],
  socials: [
    { label: "AgroCylo - X", icon: RiTwitterXLine, path: undefined as string | undefined },
    { label: "Instagram", icon: RxInstagramLogo, path: undefined as string | undefined },
    { label: "LinkedIn", icon: PiLinkedinLogo, path: undefined as string | undefined },
    { label: "Facebook", icon: PiFacebookLogo, path: undefined as string | undefined },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-canvas-dark flex w-full flex-col text-white">
      <Wrapper className="flex flex-col pt-20 pb-10 sm:pb-16">
        <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2">
          <nav>
            <ul role="list" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {footerLinks.routes.map((link) => (
                <li key={link.title}>
                  <div className="font-display text-lg font-semibold tracking-wider">
                    {link.title}
                  </div>
                  <ul role="list" className="mt-4 text-sm">
                    {link.routes.map((route) => (
                      <li key={route.label} className="mt-4">
                        <a
                          className="hover:text-primary transition"
                          href={route.path}
                        >
                          {route.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex lg:justify-end">
            <div className="w-full sm:max-w-[363px]">
              <Link href="/" className="-ml-1 inline-block w-fit">
                <Image
                  src="/logo-light.svg"
                  alt={siteConfig.title}
                  height={49}
                  width={131}
                  priority
                  quality={100}
                  className="!h-[34px] !w-[100px] object-contain sm:!h-[49px] sm:!w-[131px]"
                />
              </Link>
              <p className="mt-3 text-[15px] leading-[1.6]">
                Building a fair and transparent agricultural marketplace on the
                Stellar blockchain.
              </p>

              <div className="mt-6 flex items-center gap-5">
                {footerLinks.socials.map((social, index) => (
                  <button
                    key={index}
                    disabled={!social.path}
                    className="size-fit disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Link
                      title={social.label}
                      href={social.path ?? "/"}
                      target={social.path ? "_blank" : "_self"}
                    >
                      <social.icon className="size-6 cursor-pointer transition" />
                    </Link>
                  </button>
                ))}
                <span className="bg-border/30 h-px w-full flex-1" />
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-border/30 my-10 sm:my-16" />

        <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:justify-between">
          <p className="flex items-center gap-3 text-sm font-medium">
            <span>Powered by</span>
            <Link
              href="https://stellar.org/"
              target="_blank"
              className="font-semibold hover:text-primary"
            >
              Stellar
            </Link>
          </p>

          <p className="text-sm font-medium">
            © {new Date().getFullYear()} AgroCylo. All rights reserved.
          </p>
        </div>
      </Wrapper>
    </footer>
  );
}
