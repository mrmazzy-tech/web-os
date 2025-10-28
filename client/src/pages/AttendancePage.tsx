// --- FINAL, REFINED content for client/src/pages/AttendancePage.tsx ---

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
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge"; // For summary

// --- Types ---
interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
}
interface Student {
  _id: string;
  fullName: string;
  rollNumber?: string;
}
type AttendanceStatus = "Present" | "Absent" | "Late" | "Leave"; // Define type alias

interface AttendanceRecordFromAPI {
  _id: string;
  studentId: Student | string | null; // Allow string ID before population
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  markedBy?: {
    _id: string;
    fullName: string;
  };
}

interface AttendanceEntry {
  studentId: string;
  fullName: string;
  rollNumber?: string;
  status: AttendanceStatus;
  recordId?: string; // ID of the existing attendance record, if any
  markedBy?: string; // Name of the user who last marked
}
// --- End Types ---

const getTodayDateString = () => {
  const today = new Date();
  // Format YYYY-MM-DD for input type="date"
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AttendancePage() {
  const [, setLocation] = useLocation();
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [attendanceList, setAttendanceList] = useState<AttendanceEntry[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const token = localStorage.getItem("authToken");

  // --- Helper: Get Token ---
  const getToken = useCallback(() => {
    const currentToken = localStorage.getItem("authToken");
    if (!currentToken) {
      setError("Not authenticated. Redirecting to login...");
      // Ensure loading states are false if redirecting
      setIsLoadingClasses(false);
      setIsLoadingAttendance(false);
      setTimeout(() => setLocation("/login"), 1500);
    }
    return currentToken;
  }, [setLocation]);

  // --- Fetch available classes for the dropdown ---
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
        setAvailableClasses(data.sort((a, b) => a.name.localeCompare(b.name))); // Sort classes
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
  }, [getToken, setLocation]); // Add getToken

  // --- Fetch Students & Attendance when filters change ---
  const fetchDataForClass = useCallback(async () => {
    if (!selectedClassId || !selectedDate) {
      setAttendanceList([]);
      return;
    }
    setIsLoadingAttendance(true);
    setError(null);
    setSuccessMessage(null);
    const currentToken = getToken();
    if (!currentToken) {
      setIsLoadingAttendance(false); // Ensure loading stops if no token
      return;
    }

    try {
      const [studentsResponse, attendanceResponse] = await Promise.all([
        fetch(`/api/students?classId=${selectedClassId}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        fetch(
          `/api/attendance?date=${selectedDate}&classId=${selectedClassId}`,
          { headers: { Authorization: `Bearer ${currentToken}` } },
        ),
      ]);

      if (
        studentsResponse.status === 401 ||
        studentsResponse.status === 403 ||
        attendanceResponse.status === 401 ||
        attendanceResponse.status === 403
      ) {
        throw new Error("Authentication failed. Please log in again.");
      }

      if (!studentsResponse.ok) throw new Error("Failed to fetch students.");
      if (!attendanceResponse.ok)
        throw new Error("Failed to fetch attendance records.");

      const students: Student[] = await studentsResponse.json();
      const existingRecords: AttendanceRecordFromAPI[] =
        await attendanceResponse.json();

      // Create a map of existing records for quick lookup
      const recordsMap = new Map<
        string,
        { _id: string; status: AttendanceStatus; markedBy?: string }
      >();
      existingRecords.forEach((rec) => {
        // Handle both populated and unpopulated studentId safely
        const studentIdString =
          typeof rec.studentId === "object" && rec.studentId !== null
            ? rec.studentId._id
            : typeof rec.studentId === "string"
              ? rec.studentId
              : null;

        if (studentIdString) {
          recordsMap.set(studentIdString, {
            _id: rec._id,
            status: rec.status,
            markedBy: rec.markedBy?.fullName,
          });
        }
      });

      // Merge student list with attendance data
      const mergedList: AttendanceEntry[] = students
        .map((student) => {
          const existingRecord = recordsMap.get(student._id);
          return {
            studentId: student._id,
            fullName: student.fullName,
            rollNumber: student.rollNumber,
            status: existingRecord ? existingRecord.status : "Present", // Default to Present
            recordId: existingRecord?._id,
            markedBy: existingRecord?.markedBy,
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName)); // Sort by name

      setAttendanceList(mergedList);
    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoadingAttendance(false);
    }
  }, [selectedDate, selectedClassId, getToken, setLocation]); // Add getToken, setLocation

  useEffect(() => {
    fetchDataForClass();
  }, [fetchDataForClass]); // Trigger fetch when function reference changes

  // --- Update Handler (in-memory) ---
  const handleStatusChange = (
    studentId: string,
    newStatus: AttendanceStatus,
  ) => {
    setAttendanceList((currentList) =>
      currentList.map((entry) =>
        entry.studentId === studentId ? { ...entry, status: newStatus } : entry,
      ),
    );
    setSuccessMessage(null); // Clear success message if status changes after save
    setError(null); // Clear error message
  };

  // --- Save Handler (sends to backend) ---
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    const currentToken = getToken();
    if (!currentToken) {
      setIsSaving(false);
      return; // Error handled by getToken
    }

    // Prepare only necessary data for the backend
    const payload = attendanceList.map((entry) => ({
      studentId: entry.studentId,
      date: selectedDate,
      status: entry.status,
    }));

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to save attendance.");
      }
      setSuccessMessage("Attendance saved successfully!");

      // --- Efficiently update markedBy after save ---
      // We don't need to refetch everything, just update the markedBy field
      // Get current user details (assuming it's stored somewhere or fetch it)
      // For now, let's simulate fetching it - IN A REAL APP use context or a hook
      const userRes = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const userData = await userRes.json();
      const markerName = userData?.fullName || "Current User"; // Fallback

      // Update the local list with the marker name (no need to refetch)
      setAttendanceList((currentList) =>
        currentList.map((entry) => ({
          ...entry,
          // Update status based on latest save & add marker name
          status:
            payload.find((p) => p.studentId === entry.studentId)?.status ||
            entry.status,
          markedBy: markerName,
        })),
      );
      // --- End efficient update ---
    } catch (err: any) {
      console.error("Save Attendance Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // --- Summary Calculation ---
  const attendanceSummary = useMemo(() => {
    const summary: Record<AttendanceStatus | "Total", number> = {
      // Use Record type
      Present: 0,
      Absent: 0,
      Late: 0,
      Leave: 0,
      Total: attendanceList.length,
    };
    for (const entry of attendanceList) {
      summary[entry.status]++;
    }
    return summary;
  }, [attendanceList]);

  // Get the name of who marked it (just find the first instance)
  const markedByName = useMemo(() => {
    return attendanceList.find((entry) => entry.markedBy)?.markedBy;
  }, [attendanceList]);

  // --- Render Logic ---
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Manage Attendance</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Class Selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="class-select"
              className="text-sm font-medium shrink-0"
            >
              Class:
            </label>
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={isLoadingClasses || availableClasses.length === 0}
            >
              <SelectTrigger className="h-10 w-[180px]" id="class-select">
                <SelectValue placeholder="Select class..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingClasses ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : availableClasses.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No classes found
                  </SelectItem>
                ) : (
                  availableClasses.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name} {c.section && `(${c.section})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="attendance-date" className="text-sm font-medium">
              Date:
            </label>
            <Input
              type="date"
              id="attendance-date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isLoadingAttendance || isSaving}
              className="h-10 w-auto"
            />
          </div>
        </div>
      </div>

      {/* Feedback Area */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" className="mb-4">
          {" "}
          {/* Use custom success variant if defined, else default */}
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            {successMessage}{" "}
            {markedByName && `(Last saved by: ${markedByName})`}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading / Empty States */}
      {isLoadingAttendance && (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading attendance...</span>
        </div>
      )}
      {!isLoadingAttendance && !selectedClassId && (
        <p className="text-muted-foreground text-center py-8">
          Please select a class and date to load attendance.
        </p>
      )}
      {!isLoadingAttendance &&
        selectedClassId &&
        attendanceList.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No students found in the selected class.
          </p>
        )}

      {/* Attendance Table & Summary */}
      {!isLoadingAttendance && attendanceList.length > 0 && (
        <>
          {/* Summary Box */}
          <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
            <h4 className="font-semibold mb-2 text-foreground">
              Class Summary (Total: {attendanceSummary.Total})
            </h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Badge variant="success">
                Present: {attendanceSummary.Present}
              </Badge>
              <Badge variant="destructive">
                Absent: {attendanceSummary.Absent}
              </Badge>
              <Badge variant="warning">Late: {attendanceSummary.Late}</Badge>
              <Badge variant="info">Leave: {attendanceSummary.Leave}</Badge>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>{" "}
                  {/* Fixed width */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceList.map((entry) => (
                  <TableRow key={entry.studentId}>
                    <TableCell className="font-medium">
                      {entry.fullName}
                    </TableCell>
                    <TableCell>{entry.rollNumber || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={entry.status}
                        onValueChange={(value) =>
                          handleStatusChange(
                            entry.studentId,
                            value as AttendanceStatus,
                          )
                        }
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Present">Present</SelectItem>
                          <SelectItem value="Absent">Absent</SelectItem>
                          <SelectItem value="Late">Late</SelectItem>
                          <SelectItem value="Leave">Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSaveAttendance}
              disabled={isSaving || isLoadingAttendance}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Attendance
                </>
              )}
            </Button>
          </div>
        </>
      )}

      <div className="mt-6 pt-4 border-t">
        <Button variant="link" className="p-0 h-auto" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
