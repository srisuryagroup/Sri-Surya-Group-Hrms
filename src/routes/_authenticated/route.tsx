import {
  createFileRoute,
  Outlet,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  Settings,
  Menu,
  Search,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { navForRole, canAccessPath, ROLE_LABEL } from "@/lib/rbac";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, role, rolesReady, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  // Block unauthorized module access for the current role.
  useEffect(() => {
    if (loading || !user || !rolesReady) return;
    if (!canAccessPath(role, pathname)) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, rolesReady, role, pathname, navigate]);

  if (loading || !user || !rolesReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const roleLabel = ROLE_LABEL[role];

  const initials =
    (user.user_metadata?.full_name || user.email || "U")
      .split(/\s+/)
      .map((s: string) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="glass-panel sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/40 lg:flex">
        <div className="px-5 pt-6 pb-4">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-4">
          <SidebarNav />
        </nav>
        <div className="border-t border-border/40 p-4">
          <div className="rounded-xl border border-border/40 bg-card/40 p-3">
            <div className="text-xs font-medium text-muted-foreground">Signed in as</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {user.email}
            </div>
            <Badge variant="secondary" className="mt-2 bg-primary/15 text-primary">
              {roleLabel}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="px-5 pt-6 pb-4"><Logo /></div>
          <nav className="space-y-1 px-3" onClick={() => setMobileOpen(false)}>
            <SidebarNav />
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass-panel sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/40 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees, projects, tasks…"
              className="border-border/60 bg-card/50 pl-9 backdrop-blur"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-surya text-xs font-semibold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium leading-tight">
                      {user.user_metadata?.full_name || user.email?.split("@")[0]}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {roleLabel}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="border-t border-border/40 px-6 py-4 text-center text-xs text-muted-foreground">
          © 2026 Sri Surya Group. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}

function SidebarNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <>
      {nav.map((item) => {
        const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-gradient-surya text-primary-foreground surya-glow"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
  return (
    <Link to="/notifications">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        {(data ?? 0) > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {(data ?? 0) > 9 ? "9+" : data}
          </span>
        )}
      </Button>
    </Link>
  );
}
