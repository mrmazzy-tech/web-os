// --- FINAL, REFINED content for client/src/pages/SuperAdminDashboard.tsx ---
// Includes functional "Approve" and "Change Plan" buttons

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

// --- Types ---
interface OwnerUser {
  _id: string;
  fullName: string;
  email: string;
}
type SubscriptionTier = "free" | "basic" | "premium" | "internal";
type PaymentStatus = "pending" | "active" | "past_due";

interface SchoolTenant {
  _id: string;
  schoolName: string;
  institutionType: string;
  subscriptionTier: SubscriptionTier;
  paymentStatus: PaymentStatus;
  isOnboardingComplete: boolean;
  ownerUserId: OwnerUser | null;
  createdAt: string;
}
interface UserData {
  role: "SuperAdmin";
  // ... other user fields
}
// --- End Types ---

// Helper to format dates
const formatSimpleDate = (isoString: string) => {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function SuperAdminDashboard({ user }: { user: UserData }) {
  const [, setLocation] = useLocation();
  const [schools, setSchools] = useState<SchoolTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- State for Modal Actions ---
  // Tracks loading state for a specific school ID
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  // Holds the school currently targeted by a modal
  const [editTarget, setEditTarget] = useState<SchoolTenant | null>(null);
  // Holds the new plan selected in the "Change Plan" modal
  const [newPlan, setNewPlan] = useState<SubscriptionTier | "">("");

  const token = localStorage.getItem("authToken");

  const fetchAllSchools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!token || user.role !== "SuperAdmin") {
      setError("Unauthorized.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/super-admin/schools", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-cache", // Always get fresh data
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please log in again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch schools");
      }

      const data: SchoolTenant[] = await response.json();
      setSchools(data);
    } catch (err: any) {
      console.error("Fetch All Schools Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, user.role, setLocation]);

  useEffect(() => {
    fetchAllSchools();
  }, [fetchAllSchools]);

  // --- Helper function to update state ---
  const setSubmittingState = (schoolId: string, state: boolean) => {
    setIsSubmitting((prev) => ({ ...prev, [schoolId]: state }));
  };

  // --- Handler for Approving a School ---
  const handleApproveSchool = async (schoolId: string) => {
    setSubmittingState(schoolId, true);
    setError(null);

    try {
      const response = await fetch(
        `/api/super-admin/schools/${schoolId}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentStatus: "active" }),
        },
      );
      const updatedSchool = await response.json();
      if (!response.ok)
        throw new Error(updatedSchool.message || "Failed to approve.");

      // Update state locally for instant UI change
      setSchools((prevSchools) =>
        prevSchools.map((school) =>
          school._id === schoolId
            ? { ...school, paymentStatus: "active" }
            : school,
        ),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingState(schoolId, false);
    }
  };

  // --- Handler for Changing a Plan ---
  const handleUpdatePlan = async () => {
    if (!editTarget || !newPlan) {
      setError("No school or plan selected.");
      return;
    }

    const schoolId = editTarget._id;
    setSubmittingState(schoolId, true);
    setError(null);

    try {
      const response = await fetch(
        `/api/super-admin/schools/${schoolId}/plan`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscriptionTier: newPlan }),
        },
      );
      const updatedSchool = await response.json();
      if (!response.ok)
        throw new Error(updatedSchool.message || "Failed to update plan.");

      // Update state locally
      setSchools((prevSchools) =>
        prevSchools.map((school) =>
          school._id === schoolId
            ? { ...school, subscriptionTier: newPlan }
            : school,
        ),
      );

      setEditTarget(null); // Close modal on success
      setNewPlan(""); // Reset plan selector
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingState(schoolId, false);
    }
  };

  const getStatusVariant = (
    status: PaymentStatus,
  ): "success" | "warning" | "destructive" | "secondary" => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "past_due":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getTierVariant = (
    tier: SubscriptionTier,
  ): "success" | "default" | "secondary" | "outline" => {
    switch (tier) {
      case "premium":
        return "success";
      case "basic":
        return "default";
      case "free":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Super-Admin: All Tenants
        </h2>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading all tenants...</span>
          </div>
        ) : schools.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No customer schools have signed up yet.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school._id}>
                    <TableCell className="font-medium">
                      {school.schoolName}
                      {!school.isOnboardingComplete && (
                        <Badge variant="outline" className="ml-2">
                          In Setup
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {school.ownerUserId ? (
                        <div>
                          <p>{school.ownerUserId.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {school.ownerUserId.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Owner not set
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getTierVariant(school.subscriptionTier)}
                        className="capitalize"
                      >
                        {school.subscriptionTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusVariant(school.paymentStatus)}
                        className="capitalize"
                      >
                        {school.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatSimpleDate(school.createdAt)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {/* --- Functional Buttons --- */}

                      {/* Approve Button (as an Alert) */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              isSubmitting[school._id] ||
                              school.paymentStatus === "active"
                            }
                          >
                            {isSubmitting[school._id] &&
                            school.paymentStatus === "pending" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve School?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will change the status of "
                              {school.schoolName}" from 'Pending' to 'Active'.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleApproveSchool(school._id)}
                            >
                              Approve
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Change Plan Button (as an Alert) */}
                      <AlertDialog
                        onOpenChange={(open) => {
                          if (open) {
                            setEditTarget(school); // Set school when modal opens
                            setNewPlan(school.subscriptionTier); // Pre-fill select
                          } else {
                            setEditTarget(null); // Clear on close
                            setNewPlan("");
                            setError(null); // Clear errors
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSubmitting[school._id]}
                          >
                            {isSubmitting[school._id] &&
                            editTarget?._id === school._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Change Plan"
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Change Plan for "{editTarget?.schoolName}"
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Select a new subscription tier for this school.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4 space-y-2">
                            <Label htmlFor="plan-select">
                              New Subscription Plan
                            </Label>
                            <Select
                              value={newPlan}
                              onValueChange={(value) =>
                                setNewPlan(value as SubscriptionTier)
                              }
                            >
                              <SelectTrigger id="plan-select">
                                <SelectValue placeholder="Select a plan..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="internal">
                                  Internal (Hidden)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {error && (
                              <p className="text-sm text-destructive mt-2">
                                {error}
                              </p>
                            )}
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleUpdatePlan}
                              disabled={
                                !newPlan ||
                                newPlan === editTarget?.subscriptionTier
                              }
                            >
                              Save Changes
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
