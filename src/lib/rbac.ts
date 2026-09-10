import {
  LayoutDashboard,
  Users,
  Briefcase,
  Building2,
  FolderKanban,
  CheckSquare,
  BadgeIndianRupee,
  FileText,
  Bell,
  Settings,
  CalendarCheck,
  ClipboardList,
  Wallet,
  BarChart3,
  UserCircle,
  Send,
  type LucideIcon,
} from "lucide-react";

export type Role =
  | "super_admin"
  | "hr_manager"
  | "manager"
  | "employee"
  | "freelancer";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  hr_manager: "HR Manager",
  manager: "Manager",
  employee: "Employee",
  freelancer: "Freelancer",
};

/** Highest-privilege role wins when a user holds several. */
const ROLE_PRIORITY: Role[] = [
  "super_admin",
  "hr_manager",
  "manager",
  "freelancer",
  "employee",
];

export function primaryRole(roles: Role[]): Role {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "employee";
}

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const MGMT: Role[] = ["super_admin", "hr_manager", "manager"];
const HR: Role[] = ["super_admin", "hr_manager"];
const ALL: Role[] = ["super_admin", "hr_manager", "manager", "employee", "freelancer"];

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { to: "/employees", label: "Employees", icon: Users, roles: MGMT },
  { to: "/freelancers", label: "Freelancers", icon: Briefcase, roles: MGMT },
  { to: "/departments", label: "Departments", icon: Building2, roles: MGMT },
  { to: "/projects", label: "Projects", icon: FolderKanban, roles: ALL },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, roles: ALL },
  { to: "/my-work", label: "My Work", icon: Send, roles: ["freelancer"] },
  { to: "/earnings", label: "Earnings", icon: BadgeIndianRupee, roles: ["freelancer"] },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarCheck,
    roles: [...MGMT, "employee"],
  },
  { to: "/leave", label: "Leave", icon: ClipboardList, roles: [...MGMT, "employee"] },
  { to: "/payroll", label: "Payroll", icon: Wallet, roles: [...HR, "employee"] },
  { to: "/commissions", label: "Commissions", icon: BadgeIndianRupee, roles: MGMT },
  { to: "/documents", label: "Documents", icon: FileText, roles: ALL },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: MGMT },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ALL },
  {
    to: "/my-profile",
    label: "My Profile",
    icon: UserCircle,
    roles: ["employee", "freelancer"],
  },
  { to: "/settings", label: "Settings", icon: Settings, roles: HR },
];

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function canAccessPath(role: Role, pathname: string): boolean {
  return navForRole(role).some(
    (i) => pathname === i.to || pathname.startsWith(`${i.to}/`),
  );
}
