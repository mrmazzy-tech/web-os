// --- FINAL, REFINED content for client/src/components/AddTeacherForm.tsx ---

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox"; // For class selection
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
import { ScrollArea } from "@/components/ui/scroll-area"; // For scrollable checkboxes

// --- Types ---
interface SchoolClass {
  _id: string;
  name: string;
  section?: string;
}
interface AddTeacherFormProps {
  onTeacherAdded: () => void;
  onCancel: () => void;
}
// --- End Types ---

// --- Zod Schema for Validation ---
const teacherFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full Name must be at least 2 characters.",
  }),
  subject: z.string().min(2, {
    message: "Subject must be at least 2 characters.",
  }),
  contactNumber: z.string().optional(),
  classAssignments: z.array(z.string()).optional().default([]), // Array of Class IDs
});
type TeacherFormData = z.infer<typeof teacherFormSchema>;
// --- End Zod Schema ---

export default function AddTeacherForm({
  onTeacherAdded,
  onCancel,
}: AddTeacherFormProps) {
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const token = localStorage.getItem("authToken");

  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: {
      fullName: "",
      subject: "",
      contactNumber: "",
      classAssignments: [],
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
        // Sort classes
        setAvailableClasses(
          data.sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;
            return (a.section ?? "").localeCompare(b.section ?? "");
          }),
        );
      } catch (err: any) {
        console.error("Fetch Classes Error:", err);
        setApiError(err.message);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    fetchClasses();
  }, [token]);

  // --- Submit Handler ---
  const onSubmit = async (data: TeacherFormData) => {
    setApiError(null);
    if (!token) {
      setApiError("Authentication error.");
      return;
    }
    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: data.fullName,
          subject: data.subject,
          ...(data.contactNumber && { contactNumber: data.contactNumber }),
          classAssignments: data.classAssignments || [], // Ensure array is sent
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to add teacher.");
      }
      onTeacherAdded(); // Success
    } catch (err: any) {
      console.error("Add Teacher API Error:", err);
      setApiError(err.message);
    }
  };

  // --- Render Logic ---
  if (apiError && !isLoadingClasses) {
    // Show critical errors first
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
                <Input placeholder="Teacher's Full Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Main Subject *</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Mathematics" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 0300-..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Class Assignments Checkboxes */}
        <FormField
          control={form.control}
          name="classAssignments"
          render={() => (
            <FormItem>
              <FormLabel>Assign to Classes (Optional)</FormLabel>
              {isLoadingClasses ? (
                <p className="text-sm text-muted-foreground">
                  Loading classes...
                </p>
              ) : availableClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 border rounded-md">
                  No classes found. Add classes in 'Manage Classes' first.
                </p>
              ) : (
                <ScrollArea className="h-40 w-full rounded-md border p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 ">
                    {availableClasses.map((cls) => (
                      <FormField
                        key={cls._id}
                        control={form.control}
                        name="classAssignments"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(cls._id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([
                                        ...(field.value ?? []),
                                        cls._id,
                                      ])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== cls._id,
                                        ),
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                              {cls.name} {cls.section && `(${cls.section})`}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
              <FormMessage /> {/* For potential array-level errors if needed */}
            </FormItem>
          )}
        />

        {/* Display specific API error for this form */}
        {apiError && isLoadingClasses === false && (
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...
              </>
            ) : (
              "Add Teacher"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
