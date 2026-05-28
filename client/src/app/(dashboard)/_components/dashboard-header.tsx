"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ConnectWallet from "@/components/shared/connect-wallet";
import { DashboardSidebar } from "./dashboard-sidebar";

export function DashboardHeader() {
  return (
    <header className="bg-background flex h-16 items-center gap-4 border-b px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <DashboardSidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />
      <ThemeToggle />
      <ConnectWallet />
    </header>
  );
}
