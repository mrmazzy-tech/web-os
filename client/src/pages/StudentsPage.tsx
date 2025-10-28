// --- FINAL, REFINED content for client/src/pages/StudentsPage.tsx ---

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import AddStudentForm from "@/components/AddStudentForm";
import EditStudentForm from "@/components/EditStudentForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // To allow closing the dialog
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Trash2, Edit, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Types ---
interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
}
export interface Student {
  _id: string;
  fullName: string;
  classId: SchoolClass; // Populated object
  rollNumber?: string;
  parentContact?: string;
}
// --- End Types ---

export default function StudentsPage() {
  const [, setLocation] = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for Add/Edit Modals (Dialogs)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  // State for Delete Confirmation (AlertDialog)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Fetch Students ---
  const fetchStudents = useCallback(async () => {
    if (!isLoading) setIsLoading(true); // Show loading indicator on refetch
    setError(null);
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Not authenticated. Redirecting to login...");
      setIsLoading(false);
      setTimeout(() => setLocation("/login"), 1500);
      return;
    }

    try {
      const response = await fetch("/api/students", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-cache", // Ensure fresh data
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("authToken");
          throw new Error("Authentication failed. Please log in again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch students");
      }
      const data: Student[] = await response.json();
      setStudents(data);
    } catch (err: any) {
      console.error("Fetch Students Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  }, [setLocation, isLoading]); // Add isLoading to dependencies

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // --- Handlers for Modals ---
  const handleStudentAdded = () => {
    setIsAddDialogOpen(false);
    fetchStudents(); // Refresh data
  };
  const handleStudentUpdated = () => {
    setIsEditDialogOpen(false);
    setStudentToEdit(null);
    fetchStudents(); // Refresh data
  };
  const handleOpenEditDialog = (student: Student) => {
    setStudentToEdit(student);
    setIsEditDialogOpen(true);
  };
  const handleOpenDeleteDialog = (studentId: string, studentName: string) => {
    setStudentToDelete({ id: studentId, name: studentName });
    setIsDeleteDialogOpen(true);
  };

  // --- Delete Handler ---
  const executeDeleteStudent = async () => {
    if (!studentToDelete) return;

    setIsDeleting(true);
    setError(null);
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Authentication error.");
      setIsDeleting(false);
      return;
    }

    try {
      const response = await fetch(`/api/students/${studentToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || `Failed to delete student.`);
      }
      setStudentToDelete(null); // Clear selection
      fetchStudents(); // Refresh list on success
    } catch (err: any) {
      console.error("Delete Student API Error:", err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false); // Close confirmation dialog regardless of outcome
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading && students.length === 0) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading students...</span>
        </div>
      );
    }

    if (error && students.length === 0) {
      return (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (students.length === 0) {
      return (
        <p className="text-muted-foreground mt-4 text-center">
          No students added yet. Click "Add New Student" to begin.
        </p>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Roll No.</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student._id}>
                <TableCell className="font-medium">
                  {student.fullName}
                </TableCell>
                <TableCell>
                  {student.classId?.name || "N/A"}{" "}
                  {student.classId?.section && `(${student.classId.section})`}
                </TableCell>
                <TableCell>{student.rollNumber || "-"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditDialog(student)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      handleOpenDeleteDialog(student._id, student.fullName)
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold tracking-tight flex items-center">
            Manage Students
            {isLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground ml-3" />
            )}
          </h2>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add New Student</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              {/* Pass setIsAddDialogOpen to allow the form to close itself */}
              <AddStudentForm
                onStudentAdded={handleStudentAdded}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {error &&
          !isLoading && ( // Show general errors only when not loading initial data
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

        {renderContent()}

        <div className="mt-6">
          <Button variant="link" className="p-0 h-auto" asChild>
            <Link href="/dashboard">&larr; Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* --- Edit Dialog --- */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {studentToEdit && (
            <EditStudentForm
              studentToEdit={studentToEdit}
              onStudentUpdated={handleStudentUpdated}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setStudentToEdit(null);
              }}
            />
          )}
          {/* Add a close button if needed, or rely on clicking outside/Esc */}
          {/* <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose> */}
        </DialogContent>
      </Dialog>

      {/* --- Delete Confirmation Dialog --- */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              student{" "}
              <span className="font-semibold">{studentToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setStudentToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteStudent}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...
                </>
              ) : (
                "Delete Student"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
