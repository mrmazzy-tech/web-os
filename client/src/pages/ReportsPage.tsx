// --- FINAL, REFINED content for client/src/pages/ReportsPage.tsx ---

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // <-- Re-enabled imports
import { AlertCircle, Loader2 } from "lucide-react";

// --- Types ---
interface ReportSummary {
  dateRange: { startDate: string; endDate: string };
  attendance: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    totalRecords: number;
  };
  financial: { totalCollectedInPeriod: number };
  studentCount: number;
}
interface SchoolClass {
  // Use the standard Class type
  _id: string;
  name: string;
  section?: string;
}
// --- End Types ---

// Helper to format currency
const formatCurrency = (amount: number) => {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// Helper to get date string
const getTodayDateString = (daysAgo: number = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function ReportsPage() {
  const [, setLocation] = useLocation();
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);

  const [isLoading, setIsLoading] = useState(false); // Single loading state for report generation
  const [isLoadingClasses, setIsLoadingClasses] = useState(true); // For initial class load
  const [error, setError] = useState<string | null>(null);

  // --- Filter State ---
  const [startDate, setStartDate] = useState(getTodayDateString(7)); // Default to 7 days ago
  const [endDate, setEndDate] = useState(getTodayDateString(0)); // Default to today
  const [selectedClassId, setSelectedClassId] = useState<string>("all"); // Default to "all"

  // --- Helper: Get Token ---
  const getToken = useCallback(() => {
    const currentToken = localStorage.getItem("authToken");
    if (!currentToken) {
      setError("Not authenticated. Redirecting to login...");
      setIsLoading(false);
      setIsLoadingClasses(false);
      setTimeout(() => setLocation("/login"), 1500);
    }
    return currentToken;
  }, [setLocation]);

  // --- Fetch Available Classes (Runs Once) ---
  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoadingClasses(true);
      setError(null);
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch("/api/classes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication failed.");
          }
          throw new Error("Failed to fetch class list.");
        }
        const data: SchoolClass[] = await response.json();
        setAvailableClasses(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err: any) {
        console.error("Fetch Classes Error:", err);
        setError(err.message);
        if (err.message.includes("Authentication")) {
          setTimeout(() => setLocation("/login"), 1500);
        }
      } finally {
        setIsLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [getToken, setLocation]);

  // --- Fetch Report Function ---
  const fetchFullReportData = async () => {
    if (!startDate || !endDate) {
      setError("Please select both a start and end date.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReport(null); // Clear previous report
    const token = getToken();
    if (!token) return;

    try {
      const queryParams = new URLSearchParams({ startDate, endDate });
      if (selectedClassId && selectedClassId !== "all") {
        queryParams.append("classId", selectedClassId);
      }

      const reportResponse = await fetch(
        `/api/reports/summary?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!reportResponse.ok) {
        if (reportResponse.status === 401 || reportResponse.status === 403) {
          throw new Error("Authentication failed. Please log in again.");
        }
        const errData = await reportResponse.json().catch(() => ({}));
        throw new Error(
          errData.message ||
            `Failed to generate report (${reportResponse.status})`,
        );
      }

      const reportData: ReportSummary = await reportResponse.json();
      setReport(reportData);
    } catch (err: any) {
      console.error("Fetch Report Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Calculate Percentage Helper ---
  const calculatePercentage = (count: number, total: number) => {
    return total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0.0%";
  };

  // --- RENDER LOGIC ---

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          School Operations Report
        </h2>
        <Button variant="link" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Start Date */}
          <div>
            <Label htmlFor="start-date" className="mb-1 block">
              Start Date
            </Label>
            <Input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isLoading || isLoadingClasses}
              className="h-10"
            />
          </div>
          {/* End Date */}
          <div>
            <Label htmlFor="end-date" className="mb-1 block">
              End Date
            </Label>
            <Input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isLoading || isLoadingClasses}
              className="h-10"
            />
          </div>

          {/* --- Refined Class Filter --- */}
          <div>
            <Label htmlFor="filter-class" className="mb-1 block">
              Filter Class
            </Label>
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={
                isLoadingClasses || availableClasses.length === 0 || isLoading
              }
            >
              <SelectTrigger className="h-10 w-full" id="filter-class">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {availableClasses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name} {c.section && `(${c.section})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* --- End Class Filter --- */}

          {/* Refresh Button */}
          <Button
            onClick={fetchFullReportData}
            disabled={isLoading || isLoadingClasses || !startDate || !endDate}
            className="h-10 w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </div>
      </div>

      {/* General Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Report Display Area */}
      {isLoading && (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Generating report...</span>
        </div>
      )}

      {!isLoading && !report && !error && (
        <div className="text-center py-10 text-muted-foreground">
          Please select a date range and click "Generate Report".
        </div>
      )}

      {!isLoading && report && (
        <div className="space-y-6 pt-4">
          <h3 className="text-xl font-bold border-b pb-2">
            Results for{" "}
            {new Date(report.dateRange.startDate).toLocaleDateString()} to{" "}
            {new Date(report.dateRange.endDate).toLocaleDateString()}
          </h3>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Financial Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-md border border-green-200">
                  <p className="text-xs text-muted-foreground">
                    Total Fees Collected in Period
                  </p>
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(report.financial.totalCollectedInPeriod)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-muted/50 rounded-md border">
                    <p className="text-2xl font-bold">
                      {report.attendance.totalRecords}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total Records
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-md border">
                    <p className="text-2xl font-bold text-green-600">
                      {report.attendance.present || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Present (
                      {calculatePercentage(
                        report.attendance.present || 0,
                        report.attendance.totalRecords,
                      )}
                      )
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-md border">
                    <p className="text-2xl font-bold text-red-600">
                      {report.attendance.absent || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Absent (
                      {calculatePercentage(
                        report.attendance.absent || 0,
                        report.attendance.totalRecords,
                      )}
                      )
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-md border">
                    <p className="text-2xl font-bold text-yellow-600">
                      {report.attendance.late || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Late</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
