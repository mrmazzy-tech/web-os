// --- NEW FILE: client/src/pages/academics/ReportCardPage.tsx ---

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter, // Import TableFooter for totals
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Printer } from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";

// --- Types ---
interface SchoolClass {
    _id: string;
    name: string;
    section?: string;
}
interface Exam {
    _id: string;
    name: string;
    academicYear: string;
}
interface Student {
    _id: string;
    fullName: string;
    rollNumber?: string;
    classId: SchoolClass; // Expect populated class
}
interface Grade {
    _id: string;
    subject: string;
    totalMarks: number;
    obtainedMarks: number;
    remarks?: string;
}
interface ReportCardData {
    student: Student;
    exam: Exam;
    grades: Grade[];
}
// --- End Types ---

// Helper to calculate percentage
const getPercentage = (obtained: number, total: number) => {
    if (total === 0) return 0;
    return (obtained / total) * 100;
};
// Helper to get grade letter
const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
};

export default function ReportCardPage() {
    const [, setLocation] = useLocation();
    const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
    const [availableExams, setAvailableExams] = useState<Exam[]>([]);
    const [reportData, setReportData] = useState<ReportCardData | null>(null);

    const [isLoading, setIsLoading] = useState(true); // For initial dropdown load
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Filter State ---
    const [selectedExamId, setSelectedExamId] = useState<string>("");
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");

    const token = localStorage.getItem("authToken");

    // --- Helper: Get Token ---
    const getToken = useCallback(() => {
        const currentToken = localStorage.getItem("authToken");
        if (!currentToken) {
            setError("Not authenticated. Redirecting to login...");
            setIsLoading(false);
            setTimeout(() => setLocation("/login"), 1500);
        }
        return currentToken;
    }, [setLocation]);

    // --- 1. Fetch Students and Exams (for dropdowns) ---
    useEffect(() => {
        const fetchDropdownData = async () => {
            setIsLoading(true);
            setError(null);
            const currentToken = getToken();
            if (!currentToken) return;

            try {
                const [studentsRes, examsRes] = await Promise.all([
                    fetch("/api/students", {
                        headers: { Authorization: `Bearer ${currentToken}` },
                    }), // Fetch ALL students
                    fetch("/api/exams", {
                        headers: { Authorization: `Bearer ${currentToken}` },
                    }),
                ]);
                if (!studentsRes.ok)
                    throw new Error("Failed to load students.");
                if (!examsRes.ok) throw new Error("Failed to load exams.");

                setAvailableStudents(await studentsRes.json());
                setAvailableExams(await examsRes.json());
            } catch (err: any) {
                console.error("Fetch Dropdown Data Error:", err);
                setError(err.message);
                if (err.message.includes("Authentication")) {
                    setTimeout(() => setLocation("/login"), 1500);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchDropdownData();
    }, [getToken, setLocation]);

    // --- 2. Fetch Report Card Data ---
    const loadReportCard = useCallback(async () => {
        if (!selectedExamId || !selectedStudentId) {
            setReportData(null);
            return;
        }

        setIsLoadingReport(true);
        setError(null);
        const currentToken = getToken();
        if (!currentToken) return;

        try {
            const res = await fetch(
                `/api/reports/report-card?studentId=${selectedStudentId}&examId=${selectedExamId}`,
                { headers: { Authorization: `Bearer ${currentToken}` } },
            );
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(
                    errData.message || "Failed to fetch report card.",
                );
            }

            const data: ReportCardData = await res.json();
            setReportData(data);
        } catch (err: any) {
            console.error("Load Report Card Error:", err);
            setError(err.message);
            setReportData(null); // Clear old data on error
        } finally {
            setIsLoadingReport(false);
        }
    }, [selectedExamId, selectedStudentId, getToken]); // Add getToken

    // --- 3. Calculate Totals & Overall Result ---
    const reportSummary = useMemo(() => {
        if (!reportData || reportData.grades.length === 0) return null;

        let totalObtained = 0;
        let totalMarks = 0;
        let isFail = false;

        reportData.grades.forEach((grade) => {
            totalObtained += grade.obtainedMarks;
            totalMarks += grade.totalMarks;
            const percentage = getPercentage(
                grade.obtainedMarks,
                grade.totalMarks,
            );
            if (getGradeLetter(percentage) === "F") {
                isFail = true;
            }
        });

        const overallPercentage = getPercentage(totalObtained, totalMarks);
        const overallGrade = isFail ? "F" : getGradeLetter(overallPercentage);
        const status = isFail ? "Fail" : "Pass";

        return {
            totalObtained,
            totalMarks,
            overallPercentage,
            overallGrade,
            status,
        };
    }, [reportData]);

    // --- RIPPLE PRINT HANDLER ---
    // A simple print handler that uses browser print functionality
    const handlePrint = () => {
        // We can use CSS to hide the UI elements we don't want printed
        // This is a simple way, a better way involves more CSS work
        window.print();
    };

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 print:hidden">
                {" "}
                {/* Hide on print */}
                <h2 className="text-3xl font-bold tracking-tight">
                    View Report Card
                </h2>
                <Button variant="link" asChild>
                    <Link href="/dashboard">&larr; Back to Dashboard</Link>
                </Button>
            </div>

            {/* Filter Controls */}
            <Card className="print:hidden">
                {" "}
                {/* Hide on print */}
                <CardHeader>
                    <CardTitle>Select Student and Exam</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="exam-select">Exam *</Label>
                        <Select
                            value={selectedExamId}
                            onValueChange={setSelectedExamId}
                            disabled={isLoading}
                        >
                            <SelectTrigger id="exam-select">
                                <SelectValue placeholder="Select exam..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableExams.map((exam) => (
                                    <SelectItem key={exam._id} value={exam._id}>
                                        {exam.name} ({exam.academicYear})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="student-select">Student *</Label>
                        <Select
                            value={selectedStudentId}
                            onValueChange={setSelectedStudentId}
                            disabled={isLoading}
                        >
                            <SelectTrigger id="student-select">
                                <SelectValue placeholder="Select student..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStudents.map((s) => (
                                    <SelectItem key={s._id} value={s._id}>
                                        {s.fullName} ({s.classId.name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={loadReportCard}
                        disabled={
                            isLoadingReport ||
                            !selectedExamId ||
                            !selectedStudentId
                        }
                    >
                        {isLoadingReport ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Generate Report
                    </Button>
                </CardContent>
            </Card>

            {/* General Error Display */}
            {error && (
                <Alert variant="destructive" className="print:hidden">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Loading State */}
            {isLoadingReport && (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Generating report card...</span>
                </div>
            )}

            {/* --- Report Card Display --- */}
            {!isLoadingReport && reportData && reportSummary && (
                <Card
                    className="w-full max-w-3xl mx-auto shadow-lg"
                    id="report-card"
                >
                    <CardHeader className="text-center space-y-2 pt-8">
                        {/* School logo can go here */}
                        {/* <img src={user.schoolId.logoUrl} alt="School Logo" className="mx-auto h-20 w-auto" /> */}
                        <CardTitle className="text-3xl font-bold">
                            {reportData.exam.name} -{" "}
                            {reportData.exam.academicYear}
                        </CardTitle>
                        <CardDescription className="text-lg font-medium">
                            Student Report Card
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Student Info Section */}
                        <div className="border rounded-lg p-4 grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <Label className="text-xs text-muted-foreground">
                                    Student Name
                                </Label>
                                <p className="font-semibold text-lg">
                                    {reportData.student.fullName}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">
                                    Roll Number
                                </Label>
                                <p className="font-semibold text-lg">
                                    {reportData.student.rollNumber || "-"}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">
                                    Class
                                </Label>
                                <p className="font-semibold text-lg">
                                    {reportData.student.classId.name}{" "}
                                    {reportData.student.classId.section &&
                                        `(${reportData.student.classId.section})`}
                                </p>
                            </div>
                        </div>

                        {/* Marks Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">
                                            Subject
                                        </TableHead>
                                        <TableHead className="text-center">
                                            Total Marks
                                        </TableHead>
                                        <TableHead className="text-center">
                                            Obtained Marks
                                        </TableHead>
                                        <TableHead className="text-center">
                                            Percentage
                                        </TableHead>
                                        <TableHead className="text-center">
                                            Grade
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.grades.map((grade) => {
                                        const percentage = getPercentage(
                                            grade.obtainedMarks,
                                            grade.totalMarks,
                                        );
                                        const gradeLetter =
                                            getGradeLetter(percentage);
                                        return (
                                            <TableRow
                                                key={grade._id}
                                                className={
                                                    gradeLetter === "F"
                                                        ? "bg-red-50"
                                                        : ""
                                                }
                                            >
                                                <TableCell className="font-medium">
                                                    {grade.subject}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {grade.totalMarks}
                                                </TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {grade.obtainedMarks}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {percentage.toFixed(1)}%
                                                </TableCell>
                                                <TableCell
                                                    className={`text-center font-bold ${gradeLetter === "F" ? "text-destructive" : ""}`}
                                                >
                                                    {gradeLetter}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="bg-muted font-bold">
                                        <TableCell>Overall Total</TableCell>
                                        <TableCell className="text-center">
                                            {reportSummary.totalMarks}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {reportSummary.totalObtained}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {reportSummary.overallPercentage.toFixed(
                                                1,
                                            )}
                                            %
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {reportSummary.overallGrade}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>

                        {/* Final Result */}
                        <div className="mt-6 flex justify-between items-center">
                            <div>
                                <Label className="text-xs text-muted-foreground">
                                    Overall Result
                                </Label>
                                <p
                                    className={`text-2xl font-bold ${reportSummary.status === "Fail" ? "text-destructive" : "text-green-600"}`}
                                >
                                    {reportSummary.status.toUpperCase()}
                                </p>
                            </div>
                            <Button
                                onClick={handlePrint}
                                variant="outline"
                                className="print:hidden"
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Print Report
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
