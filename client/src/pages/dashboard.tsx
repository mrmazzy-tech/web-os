// --- FINAL, REFINED content for client/src/pages/dashboard.tsx ---
// NOW renders SuperAdminDashboard based on user role

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import SchoolDashboard from "./SchoolDashboard"; // Import our module
import SuperAdminDashboard from "./SuperAdminDashboard"; // --- 1. IMPORT SUPER ADMIN DASH ---
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

// --- Data Types ---
interface SchoolData {
  _id: string;
  schoolName: string;
  institutionType: string;
  subscriptionTier: "free" | "basic" | "premium";
  isOnboardingComplete: boolean;
  address?: string;
  phone?: string;
  logoUrl?: string;
}
interface UserData {
  _id: string;
  fullName: string;
  email: string;
  role:
    | "Admin"
    | "Teacher"
    | "Accountant"
    | "Parent"
    | "Student"
    | "SuperAdmin"; // Role type updated
  schoolId: SchoolData;
}
// ----------------------------------------------------

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Find the fetchUserData function in dashboard.tsx and replace it ---

  const fetchUserData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem("authToken");

    if (!token) {
      setLocation("/login");
      return;
    }

    try {
      const response = await fetch("/api/users/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("authToken");
          setLocation("/login");
          return;
        }
        throw new Error(data.message || "Failed to fetch user data");
      }

      // --- NEW SAAS GATEKEEPER LOGIC ---

      // 1. SuperAdmins are always allowed in.
      if (data.role === "SuperAdmin") {
        setUser(data);
        setIsLoading(false);
        return;
      }

      // 2. Check if onboarding is complete. If not, force to wizard.
      if (data.schoolId && !data.schoolId.isOnboardingComplete) {
        setLocation("/setup/step-1");
        return; // Stop here
      }

      // 3. Check if payment is approved. If not, force to pending page.
      if (data.schoolId && data.schoolId.paymentStatus === "pending") {
        setLocation("/pending-approval");
        return; // Stop here
      }

      // 4. If all checks pass, show the dashboard.
      setUser(data);
      // --- END SAAS GATEKEEPER LOGIC ---
    } catch (err: any) {
      console.error("Fetch User Error:", err);
      setError("Could not load user data. Please try logging in again.");
      localStorage.removeItem("authToken");
    } finally {
      setIsLoading(false);
    }
  }, [setLocation]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleLogout = useCallback(() => {
    const token = localStorage.getItem("authToken");
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.removeItem("authToken");
    setLocation("/login");
  }, [setLocation]);

  // --- RENDER LOGIC ---
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-center text-destructive-foreground">
          {error || "Could not load user data."}
        </p>
        <Button onClick={() => setLocation("/login")} className="mt-6">
          Go to Login
        </Button>
      </div>
    );
  }

  // --- Main Dashboard Render ---
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {/* SuperAdmin sees "Digilistan Platform", others see school name */}
              {user.role === "SuperAdmin"
                ? "Digilistan Platform"
                : user.schoolId.schoolName || "Digilistan Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user.fullName} ({user.role})
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </header>

        <main>
          {/* --- 2. UPDATED RENDER LOGIC --- */}
          {user.role === "Admin" && <SchoolDashboard user={user} />}

          {user.role === "SuperAdmin" && <SuperAdminDashboard user={user} />}

          {user.role === "Teacher" && (
            <div>
              <p>Teacher Dashboard Goes Here</p>
            </div>
          )}
          {user.role === "Accountant" && (
            <div>
              <p>Accountant Dashboard Goes Here</p>
            </div>
          )}
          {/* ... other roles ... */}
        </main>
      </div>
    </div>
  );
}
