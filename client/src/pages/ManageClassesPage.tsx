// --- FINAL, REFINED content for client/src/pages/ManageClassesPage.tsx ---

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
import {
    AlertCircle,
    Plus,
    Trash2,
    Edit,
    Save,
    X,
    Loader2,
} from "lucide-react";

// --- Types ---
interface SchoolClass {
    _id: string;
    name: string;
    section?: string;
}
interface UserData {
    role: string;
    schoolId: { institutionType: string };
}
// --- End Types ---

// --- Zod Schema for Validation ---
const classFormSchema = z.object({
    name: z.string().min(1, { message: "Class/Program name is required." }),
    section: z.string().optional(),
});
type ClassFormData = z.infer<typeof classFormSchema>;
// --- End Zod Schema ---

export default function ManageClassesPage() {
    const [, setLocation] = useLocation();
    const [user, setUser] = useState<UserData | null>(null);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null); // For Add form API errors

    // --- State for Inline Editing ---
    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editSection, setEditSection] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // --- State for Delete Confirmation ---
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [classToDelete, setClassToDelete] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // --- Form Hook for Adding ---
    const form = useForm<ClassFormData>({
        resolver: zodResolver(classFormSchema),
        defaultValues: { name: "", section: "" },
    });

    // --- Helper function to get token ---
    const getToken = useCallback(() => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            setError("Not authenticated. Redirecting to login...");
            setIsLoading(false); // Stop loading if no token
            setTimeout(() => setLocation("/login"), 1500);
        }
        return token;
    }, [setLocation]); // Include setLocation

    // --- Fetch initial data (User and Classes) ---
    const fetchData = useCallback(async () => {
        // No need to set loading true here if already loading from initial state
        setError(null);
        const token = getToken();
        if (!token) return;

        try {
            // Use Promise.all for parallel fetching
            const [userRes, classesRes] = await Promise.all([
                fetch("/api/users/me", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch("/api/classes", {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (
                userRes.status === 401 ||
                userRes.status === 403 ||
                classesRes.status === 401 ||
                classesRes.status === 403
            ) {
                localStorage.removeItem("authToken");
                throw new Error("Authentication failed. Please log in again.");
            }

            if (!userRes.ok) throw new Error("Failed to fetch user data");
            if (!classesRes.ok) throw new Error("Failed to fetch classes");

            const userData: UserData = await userRes.json();
            const classesData: SchoolClass[] = await classesRes.json();

            setUser(userData);
            // Sort classes alphabetically by name, then section
            setClasses(
                classesData.sort((a, b) => {
                    const nameCompare = a.name.localeCompare(b.name);
                    if (nameCompare !== 0) return nameCompare;
                    return (a.section ?? "").localeCompare(b.section ?? "");
                }),
            );
        } catch (err: any) {
            console.error("Fetch Data Error:", err);
            setError(err.message);
            if (err.message.includes("Authentication")) {
                setTimeout(() => setLocation("/login"), 1500);
            }
        } finally {
            setIsLoading(false);
        }
    }, [getToken, setLocation]); // Add dependencies

    useEffect(() => {
        fetchData();
    }, [fetchData]); // Use fetchData as dependency

    // --- Handler to Add a new class ---
    const onAddClass = async (data: ClassFormData) => {
        setFormError(null);
        const token = getToken();
        if (!token) return;

        try {
            const response = await fetch("/api/classes", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: data.name.trim(), // Trim whitespace
                    section: data.section?.trim() || undefined, // Send undefined if empty/whitespace
                }),
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.message || "Failed to add class.");

            // Success: Add to list (maintaining sort) and clear form
            setClasses((prevClasses) =>
                [...prevClasses, result].sort((a, b) => {
                    const nameCompare = a.name.localeCompare(b.name);
                    if (nameCompare !== 0) return nameCompare;
                    return (a.section ?? "").localeCompare(b.section ?? "");
                }),
            );
            form.reset({ name: "", section: "" }); // Use form.reset
        } catch (err: any) {
            console.error("Add Class Error:", err);
            setFormError(err.message); // Show API error on the form
        }
    };

    // --- Handlers for Inline Editing ---
    const startEditing = (cls: SchoolClass) => {
        setEditingClassId(cls._id);
        setEditName(cls.name);
        setEditSection(cls.section || "");
        setEditError(null); // Clear previous edit errors
    };

    const cancelEditing = () => {
        setEditingClassId(null);
        setEditName("");
        setEditSection("");
        setEditError(null);
    };

    const saveEdit = async (classId: string) => {
        // Basic validation for inline edit
        if (!editName.trim()) {
            setEditError("Class/Program name cannot be empty.");
            return;
        }
        setEditError(null);
        setIsSavingEdit(true);
        const token = getToken();
        if (!token) {
            setIsSavingEdit(false);
            return; // Error handled by getToken
        }

        try {
            const response = await fetch(`/api/classes/${classId}`, {
                // <-- Need PUT endpoint
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: editName.trim(),
                    section: editSection.trim() || undefined,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                // Handle potential duplicate error from PUT
                throw new Error(result.message || "Failed to update class.");
            }

            // Success: Update the class in the local state and exit edit mode
            setClasses((prev) =>
                prev
                    .map((c) =>
                        c._id === classId
                            ? {
                                  ...c,
                                  name: editName.trim(),
                                  section: editSection.trim() || undefined,
                              }
                            : c,
                    )
                    .sort((a, b) => {
                        // Re-sort after edit
                        const nameCompare = a.name.localeCompare(b.name);
                        if (nameCompare !== 0) return nameCompare;
                        return (a.section ?? "").localeCompare(b.section ?? "");
                    }),
            );
            cancelEditing(); // Exit edit mode
        } catch (err: any) {
            console.error("Update Class Error:", err);
            setEditError(err.message); // Show error specific to the row being edited
        } finally {
            setIsSavingEdit(false);
        }
    };

    // --- Handler to Open Delete Confirmation ---
    const openDeleteDialog = (classId: string, className: string) => {
        setFormError(null); // Clear add form error when opening delete dialog
        setClassToDelete({ id: classId, name: className });
        setIsDeleteDialogOpen(true);
    };

    // --- Handler to Execute Deletion ---
    const executeDeleteClass = async () => {
        if (!classToDelete) return;

        setIsDeleting(true);
        setError(null); // Use general error state for delete operation result
        const token = getToken();
        if (!token) {
            setIsDeleting(false);
            return;
        }

        try {
            const response = await fetch(`/api/classes/${classToDelete.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const result = await response.json().catch(() => ({})); // Catch if response is not JSON (e.g., 204 No Content)
            // Check for specific error status codes or rely on ok status
            if (!response.ok && response.status !== 204) {
                // If it fails (e.g., students assigned), show the error
                throw new Error(result.message || "Failed to delete class.");
            }

            // Success: Remove class from UI state
            setClasses((prevClasses) =>
                prevClasses.filter((c) => c._id !== classToDelete.id),
            );
            setClassToDelete(null); // Clear selection
        } catch (err: any) {
            console.error("Delete Class Error:", err);
            setError(err.message); // Show error message (e.g., "Cannot delete class...")
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false); // Close dialog
        }
    };

    // --- Render Logic ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading class data...</span>
            </div>
        );
    }

    if (error && !classes.length) {
        // Only show full page error if list is empty
        return (
            <div className="p-8 space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="link" asChild>
                    <Link href="/dashboard">&larr; Back to Dashboard</Link>
                </Button>
            </div>
        );
    }

    const isCustomInstitute = user?.schoolId.institutionType === "University";

    return (
        <>
            <div className="container mx-auto p-4 md:p-8 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">
                        Manage Classes {isCustomInstitute && "/ Programs"}
                    </h2>
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

                {/* "Add Class" Form */}
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onAddClass)}
                        className="border rounded-lg p-4 space-y-4 bg-card"
                    >
                        <h3 className="text-xl font-medium">
                            {isCustomInstitute
                                ? "Add New Program/Class"
                                : "Add New Class/Section"}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {isCustomInstitute
                                                ? "Program Name"
                                                : "Class Name"}{" "}
                                            *
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={
                                                    isCustomInstitute
                                                        ? "e.g., BS Computer Science"
                                                        : "e.g., Grade 1"
                                                }
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="section"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Section (Optional)
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., A or Morning"
                                                {...field}
                                            />
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
                                            <Plus size={18} className="mr-2" />{" "}
                                            Add Class
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

                {/* List of Existing Classes */}
                <div className="space-y-3">
                    <h3 className="text-xl font-medium">
                        Your Current Classes
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Class / Program Name</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classes.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={3}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            {isCustomInstitute
                                                ? "No programs added yet."
                                                : "No classes added yet."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    classes.map((cls) => (
                                        <TableRow key={cls._id}>
                                            <TableCell>
                                                {editingClassId === cls._id ? (
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) =>
                                                            setEditName(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="h-8"
                                                        disabled={isSavingEdit}
                                                    />
                                                ) : (
                                                    cls.name
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingClassId === cls._id ? (
                                                    <Input
                                                        value={editSection}
                                                        onChange={(e) =>
                                                            setEditSection(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Optional"
                                                        className="h-8"
                                                        disabled={isSavingEdit}
                                                    />
                                                ) : (
                                                    cls.section || "-"
                                                )}
                                                {/* Display edit error inline */}
                                                {editingClassId === cls._id &&
                                                    editError && (
                                                        <p className="mt-1 text-xs text-destructive">
                                                            {editError}
                                                        </p>
                                                    )}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {editingClassId === cls._id ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                saveEdit(
                                                                    cls._id,
                                                                )
                                                            }
                                                            disabled={
                                                                isSavingEdit
                                                            }
                                                            className="h-8 w-8 text-green-600 hover:text-green-700"
                                                        >
                                                            {isSavingEdit ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Save className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={
                                                                cancelEditing
                                                            }
                                                            disabled={
                                                                isSavingEdit
                                                            }
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                startEditing(
                                                                    cls,
                                                                )
                                                            }
                                                            className="h-8"
                                                        >
                                                            <Edit className="h-4 w-4 mr-1" />{" "}
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    cls._id,
                                                                    cls.name,
                                                                )
                                                            }
                                                            className="h-8"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-1" />{" "}
                                                            Delete
                                                        </Button>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the class{" "}
                            <span className="font-semibold">
                                {classToDelete?.name}
                            </span>
                            . Make sure no students are assigned to this class.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setClassToDelete(null)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDeleteClass}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
                                    Deleting...
                                </>
                            ) : (
                                "Delete Class"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
