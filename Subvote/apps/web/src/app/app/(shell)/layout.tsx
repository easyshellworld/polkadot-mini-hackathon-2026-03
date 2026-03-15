import { Suspense, type ReactNode } from "react";

import { AppSidebar } from "@/app/app/_components/app-sidebar";
import { WalletConnectPanel } from "@/app/app/_components/wallet-connect-panel";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-start">
      <Suspense fallback={<AppSidebarFallback />}>
        <AppSidebar />
      </Suspense>
      <div className="flex flex-1 py-4 pr-4">
        <div className="relative h-[calc(100vh-2rem)] min-h-0 w-full">
          <div className="pointer-events-none absolute top-0 right-0 z-20">
            <div className="pointer-events-auto">
              <WalletConnectPanel />
            </div>
          </div>

          <main className="h-full min-h-0 overflow-hidden rounded-[2rem] border border-black/8 bg-[rgba(247,243,236,0.84)] p-3 shadow-[0_30px_90px_rgba(24,27,32,0.14)] backdrop-blur-xl">
            <div className="h-full overflow-y-auto overscroll-contain rounded-[1.6rem] border border-black/6 bg-[rgba(255,255,255,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:p-6">
              <div className="min-h-full">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function AppSidebarFallback() {
  return (
    <aside className="m-4 h-[calc(100vh-2rem)] w-[5.7rem] shrink-0 rounded-[2rem] border border-black/8 bg-[rgba(247,243,236,0.88)] shadow-[0_24px_70px_rgba(24,27,32,0.12)] backdrop-blur-xl" />
  );
}
