// --- NEW FILE: client/src/pages/academics/EnterMarksPage.tsx ---
// FIX: Correctly initialize 'form' variable from useForm

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";

// --- Import Form components ---
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  // FormLabel, // Not using FormLabel inside the table for simplicity
  FormMessage,
} from "@/components/ui/form";

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
}
interface Grade {
  _id: string;
  studentId: {
    _id: string;
    fullName: string;
    rollNumber?: string;
  };
  obtainedMarks: number;
  totalMarks: number;
  remarks?: string;
}
// Form data structure
interface MarksEntry {
  studentId: string;
  classId: string;
  examId: string;
  subject: string;
  fullName: string;
  rollNumber?: string;
  totalMarks: number;
  obtainedMarks: number | "";
  remarks: string;
}
interface MarksFormData {
  marks: MarksEntry[];
}
// --- End Types ---

// --- MOCK SUBJECTS ---
const MOCK_SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Social Studies",
  "Islamiyat",
  "Computer Science",
  "Physics",
  "Chemistry",
  "Biology",
];
// -----------------------------------------------------------------------

export default function EnterMarksPage() {
  const [, setLocation] = useLocation();
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);

  const [isLoading, setIsLoading] = useState(true); // For initial dropdown load
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null); // For form-specific errors

  // --- Filter State ---
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  const token = localStorage.getItem("authToken");

  // --- Form Hook Setup ---
  // --- THIS IS THE FIX ---
  // Assign the hook's return to 'form'
  const form = useForm<MarksFormData>({
    defaultValues: {
      marks: [],
    },
  });
  // Destructure methods from the 'form' variable
  const { control, handleSubmit, setValue, reset } = form;
  // --- END FIX ---

  // `useFieldArray` provides the list of students to render
  const { fields: studentFields, replace } = useFieldArray({
    control,
    name: "marks",
  });

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

  // --- 1. Fetch Classes and Exams (for dropdowns) ---
  useEffect(() => {
    const fetchDropdownData = async () => {
      setIsLoading(true);
      setError(null);
      const currentToken = getToken();
      if (!currentToken) return;

      try {
        const [classesRes, examsRes] = await Promise.all([
          fetch("/api/classes", {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
          fetch("/api/exams", {
            headers: { Authorization: `Bearer ${currentToken}` },
          }),
        ]);
        if (!classesRes.ok) throw new Error("Failed to load classes.");
        if (!examsRes.ok) throw new Error("Failed to load exams.");

        setAvailableClasses(await classesRes.json());
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

  // --- 2. Fetch Students & Grades (when filters change) ---
  const loadStudentMarks = useCallback(async () => {
    if (!selectedExamId || !selectedClassId || !selectedSubject) {
      replace([]); // Clear the table if filters are incomplete
      return;
    }

    setIsLoadingMarks(true);
    setError(null);
    setSuccessMessage(null);
    setFormError(null);
    const currentToken = getToken();
    if (!currentToken) return;

    try {
      // Get students in the class
      const studentsRes = await fetch(
        `/api/students?classId=${selectedClassId}`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        },
      );
      if (!studentsRes.ok)
        throw new Error("Failed to fetch students for this class.");
      const students: Student[] = await studentsRes.json();

      // Get existing grades for these filters
      const gradesRes = await fetch(
        `/api/grades?examId=${selectedExamId}&classId=${selectedClassId}&subject=${selectedSubject}`,
        { headers: { Authorization: `Bearer ${currentToken}` } },
      );
      if (!gradesRes.ok) throw new Error("Failed to fetch existing grades.");
      const grades: Grade[] = await gradesRes.json();

      // Create a map of existing grades for easy lookup
      const gradeMap = new Map<
        string,
        { obtainedMarks: number; totalMarks: number; remarks: string }
      >();
      grades.forEach((grade) => {
        const studentId = (grade.studentId as any)?._id || grade.studentId;
        gradeMap.set(studentId.toString(), {
          obtainedMarks: grade.obtainedMarks,
          totalMarks: grade.totalMarks || 100,
          remarks: grade.remarks || "",
        });
      });

      // Build the final array for the form
      const marksEntries: MarksEntry[] = students
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((student) => {
          const existingGrade = gradeMap.get(student._id);
          return {
            studentId: student._id,
            classId: selectedClassId,
            examId: selectedExamId,
            subject: selectedSubject,
            fullName: student.fullName,
            rollNumber: student.rollNumber || "-",
            totalMarks: existingGrade?.totalMarks || 100, // Default 100
            obtainedMarks: existingGrade?.obtainedMarks ?? "", // Default to empty string
            remarks: existingGrade?.remarks || "",
          };
        });

      replace(marksEntries); // Replace the entire form array with new data
    } catch (err: any) {
      console.error("Load Student Marks Error:", err);
      setError(err.message);
      replace([]); // Clear table on error
    } finally {
      setIsLoadingMarks(false);
    }
  }, [selectedExamId, selectedClassId, selectedSubject, getToken, replace]);

  // --- 3. Save Handler (sends to backend) ---
  const onSubmit = async (data: MarksFormData) => {
    setIsSaving(true);
    setError(null);
    setFormError(null);
    setSuccessMessage(null);
    const currentToken = getToken();
    if (!currentToken) {
      setIsSaving(false);
      return;
    }

    // Filter out entries where marks haven't been entered
    const payload = data.marks
      .filter(
        (mark) => mark.obtainedMarks !== "" && mark.obtainedMarks !== null,
      ) // Only save rows where marks are entered
      .map((mark) => ({
        ...mark,
        obtainedMarks: Number(mark.obtainedMarks), // Ensure it's a number
        totalMarks: Number(mark.totalMarks) || 100,
      }));

    if (payload.length === 0) {
      setFormError("No marks entered to save.");
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/grades/bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to save marks.");
      }
      setSuccessMessage("Marks saved successfully!");
      // Optionally refetch to confirm, but local state should be in sync
      loadStudentMarks();
    } catch (err: any) {
      console.error("Save Marks Error:", err);
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDER LOGIC ---
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Enter Student Marks
        </h2>
        <Button variant="link" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>

      {/* General Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filter Controls */}
      <div className="border rounded-lg p-4 bg-card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
            <Label htmlFor="class-select">Class *</Label>
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={isLoading}
            >
              <SelectTrigger id="class-select">
                <SelectValue placeholder="Select class..." />
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
          <div>
            <Label htmlFor="subject-select">Subject *</Label>
            <Select
              value={selectedSubject}
              onValueChange={setSelectedSubject}
              disabled={isLoading}
            >
              <SelectTrigger id="subject-select">
                <SelectValue placeholder="Select subject..." />
              </SelectTrigger>
              <SelectContent>
                {MOCK_SUBJECTS.map(
                  (
                    subject, // Using mock subjects for now
                  ) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={loadStudentMarks}
            disabled={
              isLoadingMarks ||
              !selectedExamId ||
              !selectedClassId ||
              !selectedSubject
            }
          >
            {isLoadingMarks ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Load Students
          </Button>
        </div>
      </div>

      {isLoadingMarks && (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading students...</span>
        </div>
      )}

      {/* Marks Entry Table */}
      {!isLoadingMarks && studentFields.length > 0 ? (
        // This <Form> component requires the 'form' variable
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {successMessage && (
              <Alert
                variant="default"
                className="mb-4 bg-green-50 border-green-200 text-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}
            {formError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Save Error</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Roll No.</TableHead>
                    <TableHead className="w-[120px]">
                      Obtained Marks *
                    </TableHead>
                    <TableHead className="w-[120px]">Total Marks *</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentFields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">
                        {field.fullName}
                      </TableCell>
                      <TableCell>{field.rollNumber}</TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`marks.${index}.obtainedMarks`}
                          render={({ field: inputField, fieldState }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="e.g., 85"
                                  {...inputField}
                                  onChange={(e) =>
                                    inputField.onChange(
                                      e.target.value === ""
                                        ? ""
                                        : parseFloat(e.target.value),
                                    )
                                  }
                                />
                              </FormControl>
                              <FormMessage>
                                {fieldState.error?.message}
                              </FormMessage>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`marks.${index}.totalMarks`}
                          rules={{ required: true, min: 1 }}
                          render={({ field: inputField }) => (
                            <Input
                              type="number"
                              {...inputField}
                              onChange={(e) =>
                                inputField.onChange(
                                  parseFloat(e.target.value) || 100,
                                )
                              }
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`marks.${index}.remarks`}
                          render={({ field: inputField }) => (
                            <Input placeholder="Optional..." {...inputField} />
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={isSaving || isLoadingMarks}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save All Marks
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        !isLoading &&
        !isLoadingMarks && (
          <p className="text-muted-foreground text-center py-8">
            Select an exam, class, and subject, then click "Load Students" to
            begin.
          </p>
        )
      )}

      <div className="mt-6 pt-4 border-t">
        <Button variant="link" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
