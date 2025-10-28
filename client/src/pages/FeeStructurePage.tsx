// --- FINAL, REFINED content for client/src/pages/FeeStructurePage.tsx ---
// Includes fix for pre-filling amount on fee head selection.

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Plus, Loader2, CheckCircle2 } from "lucide-react"; // Added Loader2, CheckCircle2
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel, // This is the one for use inside the <Form>
  FormMessage,
} from "@/components/ui/form";
import { useForm, useWatch } from "react-hook-form"; // Import useWatch
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
import { Label } from "@/components/ui/label"; // Import Label

// --- Types ---
interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
}
interface FeeHead {
  _id: string;
  name: string;
  isOneTime: boolean;
}
interface FeeStructure {
  _id: string;
  feeHeadId: { _id: string; name: string } | null; // Handle potential null (deleted)
  amount: number;
}
// --- End Types ---

const getCurrentMonthYearString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

// Helper to format currency
const formatCurrency = (amount: number) => {
  // Basic formatting, adjust as needed
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

interface FeeStructureFormData {
  feeHeadId: string;
  amount: number | ""; // Allow empty string for initial/cleared state
}

export default function FeeStructurePage() {
  const [, setLocation] = useLocation();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [availableFeeHeads, setAvailableFeeHeads] = useState<FeeHead[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true); // Combined loading state
  const [isLoadingStructures, setIsLoadingStructures] = useState(false); // Specific loading for structures table
  const [isSaving, setIsSaving] = useState(false); // For form submission
  const [isCreatingHead, setIsCreatingHead] = useState(false); // Specific state for creating head
  const [error, setError] = useState<string | null>(null); // General page errors
  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMonthYearString(),
  );
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [newFeeHeadName, setNewFeeHeadName] = useState("");
  const [formError, setFormError] = useState<string | null>(null); // Specific form errors
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const token = localStorage.getItem("authToken");

  const form = useForm<FeeStructureFormData>({
    defaultValues: { feeHeadId: "", amount: "" },
  });

  // --- Watch the selected Fee Head ID ---
  const selectedFeeHeadId = useWatch({
    control: form.control,
    name: "feeHeadId",
  });

  // --- Helper: Get Token ---
  const getToken = useCallback(() => {
    const currentToken = localStorage.getItem("authToken");
    if (!currentToken) {
      setError("Not authenticated. Redirecting to login...");
      setIsLoadingData(false); // Stop loading if no token
      setIsLoadingStructures(false);
      setTimeout(() => setLocation("/login"), 1500);
    }
    return currentToken;
  }, [setLocation]);

  // --- Fetch Classes and Fee Heads for dropdowns (runs once) ---
  useEffect(() => {
    const fetchDropdownData = async () => {
      setIsLoadingData(true);
      setError(null);
      const currentToken = getToken();
      if (!currentToken) return;

      try {
        const [classesRes, feeHeadsRes] = await Promise.all([
          fetch("/api/classes", {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
          fetch("/api/fees/heads", {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
        ]);

        if (
          classesRes.status === 401 ||
          classesRes.status === 403 ||
          feeHeadsRes.status === 401 ||
          feeHeadsRes.status === 403
        ) {
          throw new Error("Authentication failed. Please log in again.");
        }
        if (!classesRes.ok) throw new Error("Failed to load classes.");
        if (!feeHeadsRes.ok) throw new Error("Failed to load fee heads.");

        const classData: SchoolClass[] = await classesRes.json();
        const headData: FeeHead[] = await feeHeadsRes.json();

        setAvailableClasses(
          classData.sort((a, b) => a.name.localeCompare(b.name)),
        );
        setAvailableFeeHeads(
          headData.sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch (err: any) {
        console.error("Fetch Dropdown Data Error:", err);
        setError(err.message);
        if (err.message.includes("Authentication")) {
          setTimeout(() => setLocation("/login"), 1500);
        }
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchDropdownData();
  }, [getToken, setLocation]); // Add getToken

  // --- Fetch Fee Structures when filters change ---
  const fetchStructures = useCallback(async () => {
    if (!selectedClassId || !selectedMonth) {
      setStructures([]); // Clear structures if no class/month selected
      return;
    }
    setIsLoadingStructures(true);
    setError(null); // Clear general error
    setSuccessMessage(null); // Clear success message on refetch
    setFormError(null); // Clear form error
    form.reset({ feeHeadId: "", amount: "" }); // Reset form when filters change
    const currentToken = getToken();
    if (!currentToken) {
      setIsLoadingStructures(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/fees/structures?monthYear=${selectedMonth}&classId=${selectedClassId}`,
        { headers: { Authorization: `Bearer ${currentToken}` } },
      );
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please log in again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Failed to fetch fees (${response.status})`,
        );
      }
      const data: FeeStructure[] = await response.json();
      setStructures(data);
    } catch (err: any) {
      console.error("Fetch Fee Structures Error:", err);
      setError(err.message); // Set general error for fetch issues
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoadingStructures(false);
    }
  }, [selectedMonth, selectedClassId, getToken, setLocation, form]); // Added form to dependencies for reset

  useEffect(() => {
    fetchStructures();
  }, [fetchStructures]); // Runs when fetchStructures function reference changes

  // --- EFFECT for PRE-FILLING AMOUNT ---
  useEffect(() => {
    // Only run if structures have loaded and a fee head is selected in the form
    if (selectedFeeHeadId && !isLoadingStructures && structures.length >= 0) {
      // Check >= 0 to handle empty structures array
      // Find if a structure exists for the currently selected fee head
      const existingStructure = structures.find(
        (s) => s.feeHeadId?._id === selectedFeeHeadId,
      );
      if (existingStructure) {
        // If found, update the form's amount field
        form.setValue("amount", existingStructure.amount, {
          shouldValidate: false,
          shouldDirty: true,
        }); // Make form dirty
      } else {
        // If not found (user selected a head with no amount set yet), clear the amount
        form.setValue("amount", "", {
          shouldValidate: false,
          shouldDirty: true,
        }); // Clear and make dirty
      }
    } else if (!selectedFeeHeadId) {
      // If no fee head is selected (e.g., after reset), ensure amount is cleared
      form.setValue("amount", "", { shouldValidate: false });
    }
    // Clear previous form errors/success messages when selection changes
    setFormError(null);
    setSuccessMessage(null);
  }, [selectedFeeHeadId, structures, form, isLoadingStructures]); // Dependencies added

  // --- Handler to Add/Update a Fee Structure ---
  const handleSetFee = async (data: FeeStructureFormData) => {
    setFormError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    const currentToken = getToken();
    if (!currentToken) {
      setIsSaving(false);
      setFormError("Authentication error.");
      return;
    }
    // Ensure amount is a number before sending
    const amountToSend =
      typeof data.amount === "number"
        ? data.amount
        : parseFloat(data.amount || "0");

    try {
      const response = await fetch("/api/fees/structures", {
        method: "POST", // Backend uses findOneAndUpdate with upsert, so POST works for both add/update
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classId: selectedClassId,
          feeHeadId: data.feeHeadId,
          amount: amountToSend, // Send the number
          monthYear: selectedMonth,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        // Re-throw the specific error message from the backend
        throw new Error(result.message || "Failed to set fee.");
      }

      setSuccessMessage(
        `Fee set successfully for ${availableFeeHeads.find((h) => h._id === data.feeHeadId)?.name || "selected head"}!`,
      );
      // Don't reset feeHeadId, just amount, so user can set multiple amounts easily
      form.reset({ feeHeadId: data.feeHeadId, amount: "" });
      // Manually trigger refetch instead of await, allows UI to update quicker
      fetchStructures();
    } catch (err: any) {
      console.error("Set Fee Error:", err);
      setFormError(err.message || "An unknown error occurred."); // Display backend error
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handler to create a new Fee Head ---
  const handleAddFeeHead = async () => {
    if (!newFeeHeadName.trim()) {
      setFormError("Please enter a name for the new fee head."); // Show error near this form
      return;
    }
    setIsCreatingHead(true);
    setFormError(null);
    setSuccessMessage(null);
    const currentToken = getToken();
    if (!currentToken) {
      setIsCreatingHead(false);
      setFormError("Authentication error."); // Show error near this form
      return;
    }

    try {
      const response = await fetch("/api/fees/heads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newFeeHeadName.trim(), // Trim name
          // isOneTime: false, // Default is false on backend schema
        }),
      });
      const newHead: FeeHead = await response.json();
      if (!response.ok) {
        // Check for specific duplicate error (if backend sends one)
        if (response.status === 400 && newHead && (newHead as any).message) {
          throw new Error((newHead as any).message);
        }
        throw new Error("Failed to create fee head.");
      }

      // Add to list and sort
      setAvailableFeeHeads((prev) =>
        [...prev, newHead].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewFeeHeadName(""); // Clear input
      // Set success message, maybe clear form error too
      setSuccessMessage(
        `Fee Head "${newHead.name}" created! You can now select it.`,
      );
      setFormError(null); // Clear potential previous errors shown here
    } catch (err: any) {
      console.error("Add Fee Head Error:", err);
      setFormError(err.message); // Show error in the "Create New" section
    } finally {
      setIsCreatingHead(false);
    }
  };

  // --- RENDER LOGIC ---
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Manage Fee Structure
        </h2>
        <Button variant="link" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fee-month" className="mb-1 block">
            Select Month:
          </Label>
          <Input
            type="month"
            id="fee-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={
              isLoadingData || isSaving || isCreatingHead || isLoadingStructures
            }
            className="h-10 w-full"
          />
        </div>
        <div>
          <Label htmlFor="class-select" className="mb-1 block">
            Select Class:
          </Label>
          <Select
            value={selectedClassId}
            onValueChange={setSelectedClassId}
            disabled={isLoadingData || availableClasses.length === 0}
          >
            <SelectTrigger className="h-10 w-full" id="class-select">
              <SelectValue
                placeholder={
                  isLoadingData ? "Loading classes..." : "Select a class..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableClasses.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name} {c.section && `(${c.section})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* General Error (e.g., failed to load classes/heads) */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Area (Show after initial data load) */}
      {!isLoadingData && !error && (
        <>
          {/* Set Fee Form (Show only when class is selected) */}
          {selectedClassId && (
            <div className="border rounded-lg p-4 space-y-3 bg-card">
              <h3 className="text-xl font-medium">
                Set Fee for{" "}
                <span className="text-primary">
                  {
                    availableClasses.find((c) => c._id === selectedClassId)
                      ?.name
                  }
                </span>{" "}
                ({selectedMonth})
              </h3>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSetFee)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <FormField
                      control={form.control}
                      name="feeHeadId"
                      // No rules needed here, handled by Select not allowing empty if required conceptually
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                          <FormLabel>Fee Head *</FormLabel>
                          <Select
                            onValueChange={field.onChange} // Updates form state
                            value={field.value} // Controlled by form state
                            disabled={
                              isSaving || availableFeeHeads.length === 0
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="h-10">
                                <SelectValue
                                  placeholder={
                                    availableFeeHeads.length === 0
                                      ? "Create a fee type first..."
                                      : "Select fee type..."
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableFeeHeads.map((h) => (
                                <SelectItem key={h._id} value={h._id}>
                                  {h.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Show validation msg only if submitted and failed */}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      rules={{
                        required: "Amount is required.",
                        min: {
                          value: 0,
                          message: "Amount cannot be negative.",
                        }, // Allow 0
                        validate: (value) =>
                          value !== "" || "Amount is required.",
                      }}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                          <FormLabel>Amount (PKR) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any" // Allow decimals
                              placeholder="Enter amount"
                              className="h-10"
                              {...field}
                              // Handle number conversion carefully
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? ""
                                    : parseFloat(e.target.value),
                                )
                              }
                              value={field.value ?? ""} // Handle potential null/undefined from reset
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={
                        isSaving ||
                        !form.formState.isDirty ||
                        !form.formState.isValid
                      }
                      className="h-10 w-full sm:w-auto"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                          Saving...
                        </>
                      ) : (
                        "Set / Update Fee"
                      )}
                    </Button>
                  </div>
                  {/* Form Specific Error/Success */}
                  {formError &&
                    !isSaving && ( // Show only if not currently saving
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                      </Alert>
                    )}
                  {successMessage &&
                    !formError &&
                    !isSaving && ( // Show only if no error and not saving
                      <Alert variant="success" className="mt-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{successMessage}</AlertDescription>
                      </Alert>
                    )}
                </form>
              </Form>
            </div>
          )}

          {/* Create New Fee Head Form */}
          <div className="border border-dashed rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-medium">Create New Fee Type</h3>
            <p className="text-sm text-muted-foreground">
              Add new fee categories (e.g., Admission Fee, Library Fund) here
              first, then set their amounts above.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <Label htmlFor="new-fee-head" className="mb-1 block">
                  New Fee Head Name *
                </Label>
                <Input
                  id="new-fee-head"
                  type="text"
                  placeholder="e.g., Sports Fee, Annual Fund"
                  value={newFeeHeadName}
                  onChange={(e) => setNewFeeHeadName(e.target.value)}
                  disabled={isCreatingHead}
                  className="h-10"
                />
              </div>
              <Button
                onClick={handleAddFeeHead}
                disabled={isCreatingHead || !newFeeHeadName.trim()}
                className="h-10 w-full sm:w-auto"
                variant="outline"
              >
                {isCreatingHead ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={18} className="mr-2" /> Create Type
                  </>
                )}
              </Button>
            </div>
            {/* Display create head errors/success here maybe using formError/successMessage, ensure clarity */}
            {/* If using formError for this section too, clear it appropriately */}
          </div>

          {/* Defined Fees Table (Show only when class is selected) */}
          {selectedClassId && (
            <div className="space-y-3">
              <h3 className="text-xl font-medium">
                Defined Fees for this Class/Month
              </h3>
              {isLoadingStructures ? (
                <div className="flex justify-center items-center h-20">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fee Head</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {structures.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No fees defined yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        // Sort structures for consistent display
                        structures
                          .sort((a, b) =>
                            (a.feeHeadId?.name ?? "").localeCompare(
                              b.feeHeadId?.name ?? "",
                            ),
                          )
                          .map((s) => (
                            <TableRow key={s._id}>
                              <TableCell className="font-medium">
                                {s.feeHeadId?.name || (
                                  <span className="text-destructive italic">
                                    Fee Head Deleted
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(s.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Back Link */}
      <div className="mt-6 pt-4 border-t">
        <Button variant="link" className="p-0 h-auto" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
