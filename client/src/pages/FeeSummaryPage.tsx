// --- FINAL, REFINED content for client/src/pages/FeeSummaryPage.tsx ---
// FIX: Corrected Select.Item value bug. "All Classes" now uses value="all".

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge"; // For status
import { Label } from "@/components/ui/label";

// --- Types ---
interface FeeSummaryEntry {
  studentId: string;
  fullName: string;
  rollNumber?: string;
  className: string;
  classSection?: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
}
interface SchoolClass {
  // For class dropdown
  _id: string;
  name: string;
  section?: string;
}
// --- End Types ---

const getCurrentMonthYearString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`; // YYYY-MM format
};

// Helper to format currency (assuming PKR)
const formatCurrency = (amount: number) => {
  // Basic formatting, adjust as needed
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export default function FeeSummaryPage() {
  const [, setLocation] = useLocation();
  const [summaryData, setSummaryData] = useState<FeeSummaryEntry[]>([]);
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMonthYearString(),
  );
  // --- FIX: Default to "all" instead of "" ---
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const token = localStorage.getItem("authToken");

  // --- Helper: Get Token ---
  const getToken = useCallback(() => {
    const currentToken = localStorage.getItem("authToken");
    if (!currentToken) {
      setError("Not authenticated. Redirecting to login...");
      setIsLoadingClasses(false);
      setIsLoadingSummary(false);
      setTimeout(() => setLocation("/login"), 1500);
    }
    return currentToken;
  }, [setLocation]);

  // --- Fetch Available Classes ---
  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoadingClasses(true);
      setError(null);
      const currentToken = getToken();
      if (!currentToken) return;

      try {
        const response = await fetch("/api/classes", {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication failed. Please login again.");
          }
          throw new Error("Failed to load classes.");
        }
        const data: SchoolClass[] = await response.json();
        setAvailableClasses(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err: any) {
        console.error("Error fetching classes:", err);
        setError("Could not load class list: " + err.message);
        if (err.message.includes("Authentication")) {
          setTimeout(() => setLocation("/login"), 1500);
        }
      } finally {
        setIsLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [getToken, setLocation]); // Add getToken

  // --- Fetch Summary Data ---
  const fetchSummary = useCallback(async () => {
    // Don't fetch if classes haven't loaded yet, or month isn't set
    if (isLoadingClasses || !selectedMonth) {
      setSummaryData([]); // Clear previous data
      return;
    }

    setIsLoadingSummary(true);
    setError(null); // Clear previous errors
    setSummaryData([]); // Clear previous data
    const currentToken = getToken();
    if (!currentToken) {
      setIsLoadingSummary(false);
      return;
    }

    const queryParams = new URLSearchParams({ monthYear: selectedMonth });
    // --- FIX: Check for "all" ---
    if (selectedClassId && selectedClassId !== "all") {
      queryParams.append("classId", selectedClassId);
    }

    try {
      const response = await fetch(
        `/api/reports/fee-summary?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        },
      );
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please log in again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Failed to fetch fee summary (${response.status})`,
        );
      }
      const data: FeeSummaryEntry[] = await response.json();
      setSummaryData(data);
    } catch (err: any) {
      console.error("Fetch Fee Summary Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoadingSummary(false);
    }
  }, [selectedMonth, selectedClassId, isLoadingClasses, getToken, setLocation]); // Add dependencies

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]); // Re-fetch when function reference changes

  // Calculate overall totals
  const overallTotals = useMemo(() => {
    return summaryData.reduce(
      (acc, curr) => {
        acc.totalDue += curr.amountDue;
        acc.totalPaid += curr.amountPaid;
        acc.totalBalance += curr.balance;
        // Determine status counts based on balance and due amount
        if (curr.amountDue <= 0) {
          // If nothing was due
          // Optionally count these separately or ignore
        } else if (curr.balance <= 0) {
          // Due amount > 0 and fully paid or overpaid
          acc.paidCount++;
        } else if (curr.balance > 0 && curr.amountPaid > 0) {
          // Due amount > 0, partially paid
          acc.partialCount++;
        } else {
          // Due amount > 0 and nothing paid
          acc.unpaidCount++;
        }
        return acc;
      },
      {
        totalDue: 0,
        totalPaid: 0,
        totalBalance: 0,
        paidCount: 0,
        partialCount: 0,
        unpaidCount: 0,
      },
    );
  }, [summaryData]);

  // --- RENDER LOGIC ---

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Fee Status Summary
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {" "}
            {/* Month */}
            <Label
              htmlFor="summary-month"
              className="text-sm font-medium shrink-0"
            >
              Month:
            </Label>
            <Input
              type="month"
              id="summary-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={isLoadingSummary || isLoadingClasses}
              className="h-10 w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            {" "}
            {/* Class */}
            <Label
              htmlFor="summary-class"
              className="text-sm font-medium shrink-0"
            >
              Class:
            </Label>
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={
                isLoadingSummary ||
                isLoadingClasses ||
                availableClasses.length === 0
              }
            >
              <SelectTrigger className="h-10 w-[200px]" id="summary-class">
                {/* Placeholder is not needed if "all" is a default value */}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* --- FIX: Use "all" as the value --- */}
                <SelectItem value="all">All Classes</SelectItem>
                {/* --- END FIX --- */}
                {availableClasses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name} {c.section && `(${c.section})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading or No Classes State */}
      {isLoadingClasses && (
        <div className="text-center py-5">Loading class data...</div>
      )}
      {!isLoadingClasses && availableClasses.length === 0 && !error && (
        <Alert variant="info">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Classes Found</AlertTitle>
          <AlertDescription>
            Please add classes in 'Manage Classes' first.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Table Area */}
      {!isLoadingClasses && ( // Removed availableClasses.length > 0 check, show table even if 0 classes
        <div className="space-y-6">
          {/* Overall Summary Badges */}
          {!isLoadingSummary && summaryData.length > 0 && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
              <h4 className="font-semibold mb-2 text-foreground">
                Overall Summary for Filter
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <p>
                  <span className="font-medium">Total Due:</span>{" "}
                  {formatCurrency(overallTotals.totalDue)}
                </p>
                <p>
                  <span className="font-medium">Total Paid:</span>{" "}
                  {formatCurrency(overallTotals.totalPaid)}
                </p>
                <p
                  className={`font-medium ${overallTotals.totalBalance > 0 ? "text-destructive" : "text-green-600"}`}
                >
                  Total Balance: {formatCurrency(overallTotals.totalBalance)}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  <Badge variant="success">
                    Fully Paid: {overallTotals.paidCount}
                  </Badge>
                  <Badge variant="warning">
                    Partially Paid: {overallTotals.partialCount}
                  </Badge>
                  <Badge variant="destructive">
                    Unpaid: {overallTotals.unpaidCount}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {isLoadingSummary ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading summary...</span>
            </div>
          ) : summaryData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No fee summary data found for the selected filters. Ensure fee
              structures are set for this month.
            </p>
          ) : (
            /* Table */
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((s) => (
                    <TableRow key={s.studentId}>
                      <TableCell className="font-medium">
                        {s.fullName} {s.rollNumber && `(${s.rollNumber})`}
                      </TableCell>
                      <TableCell>
                        {s.className} {s.classSection && `(${s.classSection})`}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.amountDue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${s.balance > 0 ? "text-destructive" : s.balance < 0 ? "text-orange-500" : "text-green-600"}`}
                      >
                        {formatCurrency(s.balance)}
                      </TableCell>
                      <TableCell className="text-center">
                        {
                          s.amountDue <= 0 ? (
                            <Badge variant="outline">N/A</Badge> // If nothing was due
                          ) : s.balance <= 0 ? (
                            <Badge variant="success">Paid</Badge> // Paid in full or overpaid
                          ) : s.balance > 0 && s.amountPaid > 0 ? (
                            <Badge variant="warning">Partial</Badge> // Partially paid
                          ) : (
                            <Badge variant="destructive">Unpaid</Badge>
                          ) // Due and unpaid
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
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
