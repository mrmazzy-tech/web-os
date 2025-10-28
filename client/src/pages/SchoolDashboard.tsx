// --- FINAL, REFINED content for client/src/pages/SchoolDashboard.tsx ---
// FIX: Corrected <a> nested in <a> warning by using asChild prop

import { Link } from "wouter";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  UserCheck,
  CalendarDays,
  Landmark,
  DollarSign,
  ClipboardList,
  BarChart3,
  Lock,
  Sparkles,
  BookCheck, // Added icon
  ClipboardCheck,
  GraduationCap,
} from "lucide-react";

// --- Define UserData type (must match what dashboard.tsx passes) ---
interface SchoolData {
  subscriptionTier: "free" | "basic" | "premium" | "internal";
  // ... other school fields
}
interface UserData {
  role: string;
  schoolId: SchoolData;
  // ... other user fields
}
// --- End Type Definition ---

// --- Define modules as an array ---
const allDashboardModules = [
  {
    href: "/dashboard/classes",
    title: "Manage Classes",
    description: "Define school classes and sections.",
    icon: BookOpen,
    plan: "free", // Available to all plans
  },
  {
    href: "/dashboard/students",
    title: "Manage Students",
    description: "Add, edit, and view student profiles.",
    icon: Users,
    plan: "free", // Available to all plans
  },
  {
    href: "/dashboard/teachers",
    title: "Manage Teachers",
    description: "Manage staff profiles and assignments.",
    icon: UserCheck,
    plan: "free", // Available to all plans
  },
  {
    href: "/dashboard/attendance",
    title: "Manage Attendance",
    description: "Mark and review daily student attendance.",
    icon: CalendarDays,
    plan: "basic", // Available to basic and premium
  },
  {
    href: "/dashboard/fees/structure",
    title: "Manage Fee Structure",
    description: "Set monthly fee amounts for each class.",
    icon: Landmark,
    plan: "basic", // Available to basic and premium
  },
  {
    href: "/dashboard/fees/payments",
    title: "Record Fee Payments",
    description: "Record new payments from students.",
    icon: DollarSign,
    plan: "basic", // Available to basic and premium
  },
  {
    href: "/dashboard/academics/exams",
    title: "Manage Exams",
    description: "Define exam terms like Mid-Terms.",
    icon: BookCheck,
    plan: "premium",
  },
  {
    href: "/dashboard/academics/marks",
    title: "Enter Marks",
    description: "Enter student grades for exams.",
    icon: ClipboardCheck,
    plan: "premium",
  },
  {
    // --- ADD THIS NEW CARD ---
    href: "/dashboard/academics/report-card",
    title: "View Report Card",
    description: "Generate and view student report cards.",
    icon: GraduationCap, // <-- Make sure to import this
    plan: "premium",
  },
  {
    href: "/dashboard/fees/summary",
    title: "View Fee Summary",
    description: "Report on due, paid, and balance amounts.",
    icon: ClipboardList,
    plan: "premium", // Premium only
  },
  {
    href: "/dashboard/reports",
    title: "View Operations Report",
    description: "See overall school financial reports.",
    icon: BarChart3,
    plan: "premium", // Premium only
  },
];

// --- Helper component for a Locked Card ---
const LockedModuleCard = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) => (
  <Card className="h-full bg-muted/50 border-dashed relative">
    <CardHeader>
      <div className="flex justify-between items-center">
        <Icon className="h-7 w-7 text-muted-foreground" />
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <CardTitle className="text-lg text-muted-foreground pt-3">
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  </Card>
);

// --- Main Dashboard Component ---
export default function SchoolDashboard({ user }: { user: UserData }) {
  // Get the user's current plan
  const userPlan = user.schoolId.subscriptionTier;

  // Determine which features are accessible
  const isAccessible = (modulePlan: string) => {
    if (userPlan === "premium" || userPlan === "internal") return true; // Premium/Internal gets all
    if (userPlan === "basic")
      return modulePlan === "free" || modulePlan === "basic"; // Basic gets free + basic
    return modulePlan === "free"; // Free only gets free
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {allDashboardModules.map((module) =>
        isAccessible(module.plan) ? (
          // --- FIX: Add `asChild` prop to Link ---
          <Link key={module.href} href={module.href} asChild>
            <a className="block outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="h-full hover:border-primary hover:shadow-lg transition-all duration-200">
                <CardHeader>
                  <module.icon className="h-7 w-7 text-primary mb-3" />
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            </a>
          </Link>
        ) : (
          // --- END FIX ---
          // --- RENDER LOCKED CARD ---
          <LockedModuleCard
            key={module.href}
            title={module.title}
            description={module.description}
            icon={module.icon}
          />
        ),
      )}

      {/* --- RENDER UPGRADE CARD for Free and Basic users --- */}
      {userPlan !== "premium" && userPlan !== "internal" && (
        <Card className="h-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-blue-700 shadow-lg">
          <CardHeader>
            <Sparkles className="h-7 w-7 text-yellow-300 mb-3" />
            <CardTitle className="text-lg">Go Premium!</CardTitle>
            <CardDescription className="text-blue-100">
              {userPlan === "free"
                ? "Unlock Attendance, Fee Management, and Reports."
                : "Unlock advanced Financial Reports and Parent Portals."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* This button would link to your pricing/upgrade page */}
            <Button variant="secondary" className="w-full">
              Upgrade Your Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
