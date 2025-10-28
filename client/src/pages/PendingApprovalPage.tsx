// --- NEW FILE: client/src/pages/PendingApprovalPage.tsx ---

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Clock } from "lucide-react";

// Minimal type for user data needed on this page
interface UserData {
  email: string;
  fullName: string;
}

export default function PendingApprovalPage() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem("authToken");

  // Fetch the user's email to display it
  useEffect(() => {
    const fetchUserEmail = async () => {
      if (!token) {
        setLocation("/login");
        return;
      }
      try {
        const response = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          // If token is invalid, just send back to login
          localStorage.removeItem("authToken");
          setLocation("/login");
          return;
        }
        const data: UserData = await response.json();
        setUser(data);
      } catch (err) {
        console.error("Fetch User Error:", err);
        // Fallback, just log out
        localStorage.removeItem("authToken");
        setLocation("/login");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserEmail();
  }, [token, setLocation]);

  const handleLogout = useCallback(() => {
    // Call the backend to clear the httpOnly cookie
    fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.removeItem("authToken");
    setLocation("/login");
  }, [setLocation, token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto bg-yellow-100 p-3 rounded-full w-fit">
            <Clock className="h-10 w-10 text-yellow-700" />
          </div>
          <CardTitle className="text-2xl mt-4">
            Account Pending Approval
          </CardTitle>
          <CardDescription>
            Thank you for signing up, {user?.fullName || "Admin"}!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your account for{" "}
            <span className="font-medium text-foreground">
              {user?.email || "your email"}
            </span>{" "}
            is currently pending approval by a Digilistan administrator.
          </p>
          <p className="text-sm text-muted-foreground">
            You will be notified via email once your account is activated
            (typically within 24 hours). You may now safely log out.
          </p>

          <Button onClick={handleLogout} variant="outline" className="w-full">
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
