// --- FINAL, REFINED content for client/src/pages/TeachersPage.tsx ---

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import AddTeacherForm from "@/components/AddTeacherForm";
import EditTeacherForm from "@/components/EditTeacherForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge"; // For displaying classes

// --- Types ---
interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
}
export interface Teacher {
  // Export for use in forms
  _id: string;
  fullName: string;
  subject: string;
  contactNumber?: string;
  classAssignments: SchoolClass[]; // Expects populated objects from API
}
// --- End Types ---

export default function TeachersPage() {
  const [, setLocation] = useLocation();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);

  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Fetch Teachers ---
  const fetchTeachers = useCallback(async () => {
    // Show loading indicator on refetch unless it's already loading initially
    if (!isLoading) setIsLoading(true);
    setError(null);
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Not authenticated. Redirecting to login...");
      setIsLoading(false);
      setTimeout(() => setLocation("/login"), 1500);
      return;
    }

    try {
      const response = await fetch("/api/teachers", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-cache",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("authToken");
          throw new Error("Authentication failed. Please log in again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to fetch teachers");
      }
      const data: Teacher[] = await response.json();
      setTeachers(data);
    } catch (err: any) {
      console.error("Fetch Teachers Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoading(false);
    }
  }, [setLocation, isLoading]); // Include dependencies

  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Fetch once on mount

  // --- Handlers ---
  const handleTeacherAdded = () => {
    setIsAddDialogOpen(false);
    fetchTeachers(); // Refresh list
  };
  const handleTeacherUpdated = () => {
    setIsEditDialogOpen(false);
    setTeacherToEdit(null);
    fetchTeachers(); // Refresh list
  };
  const handleOpenEditDialog = (teacher: Teacher) => {
    setTeacherToEdit(teacher);
    setIsEditDialogOpen(true);
  };
  const handleOpenDeleteDialog = (teacherId: string, teacherName: string) => {
    setTeacherToDelete({ id: teacherId, name: teacherName });
    setIsDeleteDialogOpen(true);
  };

  // --- Delete Handler ---
  const executeDeleteTeacher = async () => {
    if (!teacherToDelete) return;

    setIsDeleting(true);
    setError(null);
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Authentication error.");
      setIsDeleting(false);
      return;
    }

    try {
      const response = await fetch(`/api/teachers/${teacherToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Handle potential non-JSON success response (like 204)
      if (response.status === 204) {
        // Success case for 204 No Content
        setTeacherToDelete(null);
        fetchTeachers(); // Refresh list
        return; // Exit function early
      }

      const result = await response.json().catch(() => ({})); // Catch JSON parsing errors for other statuses

      if (!response.ok) {
        throw new Error(result.message || `Failed to delete teacher.`);
      }

      setTeacherToDelete(null); // Clear selection
      fetchTeachers(); // Refresh list on success (for 200 OK)
    } catch (err: any) {
      console.error("Delete Teacher API Error:", err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false); // Close confirmation dialog
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading && teachers.length === 0) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading teachers...</span>
        </div>
      );
    }

    if (error && teachers.length === 0) {
      return (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (teachers.length === 0) {
      return (
        <p className="text-muted-foreground mt-4 text-center">
          No teachers added yet. Click "Add New Teacher" to begin.
        </p>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Assigned Classes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((teacher) => (
              <TableRow key={teacher._id}>
                <TableCell className="font-medium">
                  {teacher.fullName}
                </TableCell>
                <TableCell>{teacher.subject}</TableCell>
                <TableCell>{teacher.contactNumber || "-"}</TableCell>
                <TableCell>
                  {teacher.classAssignments?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {teacher.classAssignments.map((cls) => (
                        <Badge key={cls._id} variant="secondary">
                          {cls.name} {cls.section && `(${cls.section})`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">
                      Not assigned
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditDialog(teacher)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      handleOpenDeleteDialog(teacher._id, teacher.fullName)
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
            Manage Teachers
            {isLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground ml-3" />
            )}
          </h2>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add New Teacher</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              {" "}
              {/* Slightly wider for checkboxes */}
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
              </DialogHeader>
              <AddTeacherForm
                onTeacherAdded={handleTeacherAdded}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {error && !isLoading && (
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
        <DialogContent className="sm:max-w-[550px]">
          {" "}
          {/* Slightly wider */}
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
          </DialogHeader>
          {teacherToEdit && (
            <EditTeacherForm
              teacherToEdit={teacherToEdit}
              onTeacherUpdated={handleTeacherUpdated}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setTeacherToEdit(null);
              }}
            />
          )}
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
              teacher{" "}
              <span className="font-semibold">{teacherToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setTeacherToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDeleteTeacher}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting...
                </>
              ) : (
                "Delete Teacher"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
