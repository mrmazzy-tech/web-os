// --- NEW FILE: client/src/pages/setup/SetupStep2Page.tsx ---

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn for conditional styling

// Define plan types
type PlanTier = "free" | "basic" | "premium";

export default function SetupStep2Page() {
  const [, setLocation] = useLocation();
  const [selectedTier, setSelectedTier] = useState<PlanTier>("free"); // Default to free
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("authToken");

  const handleSubmit = async () => {
    setError(null);
    setIsSaving(true);

    if (!token) {
      setLocation("/login");
      return;
    }

    try {
      const response = await fetch("/api/schools/my-school", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionTier: selectedTier,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Failed to save plan selection.");
      }

      // Success
      setLocation("/setup/step-3");
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-4xl">
        {" "}
        {/* Wider card for 3-column layout */}
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Choose Your Plan
          </CardTitle>
          <CardDescription className="text-center">
            Select a plan to get started. You can always upgrade later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Plan Card */}
            <Card
              className={cn(
                "cursor-pointer transition-all",
                selectedTier === "free"
                  ? "border-primary ring-2 ring-primary"
                  : "hover:shadow-md",
              )}
              onClick={() => setSelectedTier("free")}
            >
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>
                  Basic management for new schools.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <h3 className="text-2xl font-bold">PKR 0</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>Manage Students</li>
                  <li>Manage Classes</li>
                  <li>Manage Teachers</li>
                </ul>
              </CardContent>
              {selectedTier === "free" && (
                <CardFooter>
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="ml-2 text-sm font-medium text-primary">
                    Selected
                  </span>
                </CardFooter>
              )}
            </Card>

            {/* Basic Plan Card (Example) */}
            <Card
              className={cn(
                "cursor-pointer transition-all",
                selectedTier === "basic"
                  ? "border-primary ring-2 ring-primary"
                  : "hover:shadow-md",
              )}
              onClick={() => setSelectedTier("basic")}
            >
              <CardHeader>
                <CardTitle>Basic</CardTitle>
                <CardDescription>For growing schools.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <h3 className="text-2xl font-bold">PKR 4,999 /mo</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>Everything in Free</li>
                  <li>Manage Attendance</li>
                  <li>Basic Fee Management</li>
                </ul>
              </CardContent>
              {selectedTier === "basic" && (
                <CardFooter>
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="ml-2 text-sm font-medium text-primary">
                    Selected
                  </span>
                </CardFooter>
              )}
            </Card>

            {/* Premium Plan Card (Example) */}
            <Card
              className={cn(
                "cursor-pointer transition-all relative overflow-hidden", // For banner
                selectedTier === "premium"
                  ? "border-primary ring-2 ring-primary"
                  : "hover:shadow-md",
              )}
              onClick={() => setSelectedTier("premium")}
            >
              <div className="absolute -top-7 -right-7 bg-primary text-primary-foreground p-4 rounded-full">
                <Star className="h-5 w-5" />
              </div>
              <CardHeader>
                <CardTitle>Premium</CardTitle>
                <CardDescription>Full School OS experience.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <h3 className="text-2xl font-bold">PKR 9,999 /mo</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>Everything in Basic</li>
                  <li>Full Financial Reports</li>
                  <li>Parent/Student Portals</li>
                </ul>
              </CardContent>
              {selectedTier === "premium" && (
                <CardFooter>
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="ml-2 text-sm font-medium text-primary">
                    Selected
                  </span>
                </CardFooter>
              )}
            </Card>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save and Continue"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
