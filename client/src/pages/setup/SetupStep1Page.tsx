// --- UPDATED FILE: client/src/pages/setup/SetupStep1Page.tsx ---
// Adds 10KB file upload (Base64) instead of URL

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Upload, Image as ImageIcon } from "lucide-react"; // Added icons
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// --- Zod Schema (Updated) ---
const setupStep1Schema = z.object({
  address: z.string().min(5, { message: "Please enter a valid address." }),
  phone: z.string().min(5, { message: "Please enter a valid phone number." }),
  // --- logoUrl will now hold the Base64 data string ---
  logoUrl: z.string().optional(),
});
type Step1FormData = z.infer<typeof setupStep1Schema>;

// --- User Data Type (from /api/users/me) ---
interface UserData {
  fullName: string;
  schoolId: {
    schoolName: string;
    address?: string;
    phone?: string;
    logoUrl?: string;
  };
}

// Define the 10KB limit
const MAX_LOGO_SIZE_BYTES = 10 * 1024; // 10KB

export default function SetupStep1Page() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null); // For image preview
  const token = localStorage.getItem("authToken");

  const form = useForm<Step1FormData>({
    resolver: zodResolver(setupStep1Schema),
    defaultValues: {
      address: "",
      phone: "",
      logoUrl: "",
    },
  });

  // Fetch user and school data on load
  useEffect(() => {
    const fetchUserData = async () => {
      if (!token) {
        setLocation("/login");
        return;
      }
      try {
        const response = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403)
            setLocation("/login");
          throw new Error("Failed to fetch user data.");
        }
        const data: UserData = await response.json();
        setUser(data);

        // Pre-fill form and logo preview if data already exists
        form.reset({
          address: data.schoolId?.address || "",
          phone: data.schoolId?.phone || "",
          logoUrl: data.schoolId?.logoUrl || "", // Set the Base64 string in the form
        });
        if (data.schoolId?.logoUrl) {
          setLogoPreview(data.schoolId.logoUrl); // Set the preview
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [token, setLocation, form]);

  // --- NEW: Handle File Change ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Check Type
    if (!file.type.startsWith("image/")) {
      form.setError("logoUrl", {
        type: "manual",
        message: "File must be an image.",
      });
      return;
    }

    // 2. Check Size
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      form.setError("logoUrl", {
        type: "manual",
        message: `File is too large! Limit is 10KB. (Your file: ${Math.round(file.size / 1024)}KB)`,
      });
      return;
    }

    // 3. Convert to Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      form.setValue("logoUrl", base64String, { shouldValidate: true }); // Set the Base64 string as the form value
      setLogoPreview(base64String); // Set preview
      form.clearErrors("logoUrl"); // Clear errors on success
    };
    reader.onerror = () => {
      form.setError("logoUrl", {
        type: "manual",
        message: "Failed to read file.",
      });
    };
    reader.readAsDataURL(file);
  };

  // --- On Submit Handler ---
  const onSubmit = async (data: Step1FormData) => {
    setError(null);
    try {
      const response = await fetch("/api/schools/my-school", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // Send address, phone, and new logoUrl (Base64 string)
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Failed to save profile.");
      }
      // Success
      setLocation("/setup/step-2");
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">
            Welcome, {user?.fullName || "Admin"}!
          </CardTitle>
          <CardDescription>
            Let's set up your school profile for "
            {user?.schoolId?.schoolName || "your school"}".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Address *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 123 Main St, Lahore"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., +92 300 1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- UPDATED LOGO UPLOAD FIELD --- */}
              <FormField
                control={form.control}
                name="logoUrl" // This field holds the Base64 string
                render={() => (
                  // We don't use 'field' directly, we manage it via handleFileChange
                  <FormItem>
                    <FormLabel>School Logo (Optional, Max 10KB)</FormLabel>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center border">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo Preview"
                            className="h-full w-full object-contain rounded-md"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/png, image/jpeg, image/svg+xml"
                          onChange={handleFileChange} // Use our custom handler
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                      </FormControl>
                    </div>
                    <FormDescription className="text-xs">
                      A small, square logo is recommended (e.g., PNG, SVG).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* --- END UPDATED FIELD --- */}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save and Continue"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
