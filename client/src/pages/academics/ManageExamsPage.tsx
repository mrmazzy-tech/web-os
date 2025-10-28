// --- NEW FILE: client/src/pages/ManageExamsPage.tsx ---

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, Plus, Trash2, Loader2 } from "lucide-react";

// --- Types ---
interface Exam {
  _id: string;
  name: string;
  academicYear: string;
}
// --- End Types ---

// --- Zod Schema for Validation ---
const examFormSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Exam name is required (e.g., Mid-Terms)." }),
  academicYear: z
    .string()
    .min(4, { message: "Academic Year is required (e.g., 2025)." }),
});
type ExamFormData = z.infer<typeof examFormSchema>;
// --- End Zod Schema ---

export default function ManageExamsPage() {
  const [, setLocation] = useLocation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // --- State for Delete Confirmation ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Form Hook for Adding ---
  const form = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
    defaultValues: {
      name: "",
      academicYear: new Date().getFullYear().toString(),
    }, // Default to current year
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

  // --- Fetch Exams ---
  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFormError(null);
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/exams", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please login again.");
        }
        throw new Error("Failed to fetch exams");
      }
      const data: Exam[] = await response.json();
      setExams(data);
    } catch (err: any) {
      console.error("Fetch Exams Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  }, [getToken, setLocation]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // --- Handler to Add a new exam ---
  const onAddExam = async (data: ExamFormData) => {
    setFormError(null);
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to add exam.");
      }

      // Success: Add to list and clear form
      setExams((prev) =>
        [...prev, result].sort(
          (a, b) =>
            b.academicYear.localeCompare(a.academicYear) ||
            a.name.localeCompare(b.name),
        ),
      );
      form.reset({
        name: "",
        academicYear: new Date().getFullYear().toString(),
      });
    } catch (err: any) {
      console.error("Add Exam Error:", err);
      setFormError(err.message); // Show API error on the form
    }
  };

  // --- Handler to Open Delete Confirmation ---
  const openDeleteDialog = (examId: string, examName: string) => {
    setFormError(null); // Clear add form error
    setExamToDelete({ id: examId, name: examName });
    setIsDeleteDialogOpen(true);
  };

  // --- Handler to Execute Deletion ---
  const executeDeleteExam = async () => {
    if (!examToDelete) return;

    setIsDeleting(true);
    setError(null); // Use general error state for delete operation
    const token = getToken();
    if (!token) {
      setIsDeleting(false);
      return;
    }

    try {
      const response = await fetch(`/api/exams/${examToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to delete exam.");
      }

      // Success: Remove exam from UI state
      setExams((prev) => prev.filter((e) => e._id !== examToDelete.id));
      setExamToDelete(null);
    } catch (err: any) {
      console.error("Delete Exam Error:", err);
      setError(err.message); // Show error message (e.g., "Cannot delete exam...")
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false); // Close dialog
    }
  };

  // --- RENDER LOGIC ---
  return (
    <>
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold tracking-tight">Manage Exams</h2>
          <Button variant="link" asChild>
            <Link href="/dashboard">&larr; Back to Dashboard</Link>
          </Button>
        </div>

        {/* General Error Display (for delete errors) */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* "Add Exam" Form */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onAddExam)}
            className="border rounded-lg p-4 space-y-4 bg-card"
          >
            <h3 className="text-xl font-medium">Create New Exam Term</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Mid-Terms, Final Exams"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="academicYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2025 or 2025-2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-7">
                {" "}
                {/* Adjust alignment with labels */}
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus size={18} className="mr-2" /> Add Exam
                    </>
                  )}
                </Button>
              </div>
            </div>
            {/* Display Add Form API Errors */}
            {formError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} /> {formError}
              </p>
            )}
          </form>
        </Form>

        {/* List of Existing Exams */}
        <div className="space-y-3">
          <h3 className="text-xl font-medium">Your Current Exams</h3>
          {isLoading ? (
            <div className="flex justify-center items-center h-20">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No exam terms created yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    exams.map((exam) => (
                      <TableRow key={exam._id}>
                        <TableCell className="font-medium">
                          {exam.name}
                        </TableCell>
                        <TableCell>{exam.academicYear}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              openDeleteDialog(exam._id, exam.name)
                            }
                            className="h-8"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              exam:
              <span className="font-semibold block mt-2">
                {examToDelete?.name}
              </span>
              You can only delete an exam if no grades have been entered for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setExamToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteExam}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...
                </>
              ) : (
                "Delete Exam"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
