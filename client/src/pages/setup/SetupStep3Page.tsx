// --- NEW FILE: client/src/pages/setup/SetupStep3Page.tsx ---

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertCircle, Loader2, PartyPopper } from "lucide-react";

export default function SetupStep3Page() {
  const [, setLocation] = useLocation();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("authToken");

  const handleFinish = async () => {
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
        // Set the flag to true!
        body: JSON.stringify({
          isOnboardingComplete: true,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Failed to finalize setup.");
      }

      // Success! Redirect to the main application
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto bg-green-100 p-3 rounded-full w-fit">
            <PartyPopper className="h-10 w-10 text-green-700" />
          </div>
          <CardTitle className="text-2xl mt-4">Setup Complete!</CardTitle>
          <CardDescription>
            Your school profile and plan are all set. You can now access your
            dashboard and start managing your institution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleFinish}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...
              </>
            ) : (
              "Go to Dashboard"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
