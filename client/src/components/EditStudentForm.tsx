// --- FINAL, REFINED content for client/src/components/EditStudentForm.tsx ---

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Student } from "@/pages/StudentsPage"; // Import the Student type

// --- Types ---
interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
}
interface EditStudentFormProps {
  studentToEdit: Student; // The student object passed from the parent page
  onStudentUpdated: () => void;
  onCancel: () => void;
}
// --- End Types ---

// --- Zod Schema (same as AddStudentForm) ---
const studentFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full Name must be at least 2 characters.",
  }),
  classId: z.string().min(1, { message: "Please select a class." }),
  rollNumber: z.string().optional(),
  parentContact: z.string().optional(),
});
type StudentFormData = z.infer<typeof studentFormSchema>;
// --- End Zod Schema ---

export default function EditStudentForm({
  studentToEdit,
  onStudentUpdated,
  onCancel,
}: EditStudentFormProps) {
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const token = localStorage.getItem("authToken");

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentFormSchema),
    // --- Pre-populate form with student data ---
    defaultValues: {
      fullName: studentToEdit.fullName || "",
      // Ensure classId is just the ID string, not the object
      classId: studentToEdit.classId?._id || "",
      rollNumber: studentToEdit.rollNumber || "",
      parentContact: studentToEdit.parentContact || "",
    },
  });

  // --- Fetch available classes ---
  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoadingClasses(true);
      setApiError(null);
      if (!token) {
        setApiError("Authentication error.");
        setIsLoadingClasses(false);
        return;
      }
      try {
        const response = await fetch("/api/classes", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication failed. Please login again.");
          }
          throw new Error("Failed to load classes.");
        }
        const data: SchoolClass[] = await response.json();
        setAvailableClasses(data);
      } catch (err: any) {
        console.error("Fetch Classes Error:", err);
        setApiError(err.message);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [token]);

  // --- Submit Handler for Updating ---
  const onSubmit = async (data: StudentFormData) => {
    setApiError(null);
    if (!token) {
      setApiError("Authentication error.");
      return;
    }

    try {
      const response = await fetch(`/api/students/${studentToEdit._id}`, {
        // Use student ID in URL
        method: "PUT", // <-- Use PUT for updates
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        // Send only defined values
        body: JSON.stringify({
          fullName: data.fullName,
          classId: data.classId,
          ...(data.rollNumber && { rollNumber: data.rollNumber }),
          ...(data.parentContact && { parentContact: data.parentContact }),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to update student.");
      }
      onStudentUpdated(); // Call success function
    } catch (err: any) {
      console.error("Update Student API Error:", err);
      setApiError(err.message);
    }
  };

  // --- Render Logic ---
  if (isLoadingClasses) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading class list...</span>
      </div>
    );
  }

  // Show critical errors if class list couldn't load
  if (apiError && availableClasses.length === 0) {
    return (
      <div className="p-4 space-y-4 text-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input placeholder="Student's Full Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="classId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Class *</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value} // Use defaultValue for Select in edit mode
                disabled={isLoadingClasses || availableClasses.length === 0}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableClasses.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                      Loading...
                    </p>
                  ) : (
                    availableClasses.map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.name} {cls.section && `(${cls.section})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rollNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Roll Number (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 101"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parentContact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parent Contact (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Phone number"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {apiError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </>
            ) : (
              "Update Student"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
