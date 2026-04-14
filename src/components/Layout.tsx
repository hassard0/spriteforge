import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-10 flex items-center border-b border-border px-3 bg-card/30 backdrop-blur-sm flex-shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono">v0.2.0</span>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
