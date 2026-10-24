import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, SearchCheck, ClipboardList,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Student Attendance Sessions", url: "/student-attendance-sessions", icon: ClipboardList },
  { title: "Student Session Tracker", url: "/student-tracker", icon: SearchCheck },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          <img src="/aptech-logo.png" alt="Aptech" className="h-10 w-14 rounded bg-white object-contain p-1" />
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <p className="font-display text-sm font-bold tracking-tight">Aptech Attendance</p>
            <p className="text-xs font-medium text-sidebar-foreground/75">Management System</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url} tooltip={item.title} className={path === item.url ? "sas-sidebar-active font-semibold ring-1 ring-amber-300/30" : ""}>
                    <Link to={item.url}><item.icon /><span>{item.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
