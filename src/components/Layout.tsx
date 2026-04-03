import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-pixel animate-blink">▮</span>
              <span className="text-xs text-muted-foreground">v0.1.0</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto scanlines">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
