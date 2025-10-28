// --- FINAL, REFINED content for client/src/pages/FeePaymentsPage.tsx ---
// FIX: Added missing shadcn Form component imports

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Loader2, Receipt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Label } from "@/components/ui/label";

// --- ADDED THIS IMPORT BLOCK ---
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
// --- END ADDITION ---

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
  classId: { _id: string; name: string; section?: string };
}
interface FeeHeadBasic {
  _id: string;
  name: string;
}
interface LedgerDue {
  feeHeadId: string;
  name: string;
  due: number;
  paid: number;
  balance: number;
}
interface LedgerPaymentItem {
  feeHeadId: FeeHeadBasic | string;
  amountPaid: number;
}
interface LedgerPayment {
  _id: string;
  paymentDate: string;
  totalAmountPaid: number;
  receivedBy: { fullName: string } | null;
  items: LedgerPaymentItem[];
  remarks?: string;
}
interface StudentLedger {
  dues: LedgerDue[];
  payments: LedgerPayment[];
  summary: {
    totalDue: number;
    totalPaid: number;
    balance: number;
  };
}
// --- End Types ---

const getCurrentMonthYearString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const formatCurrency = (amount: number) => {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const paymentFormSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a number." })
    .positive({ message: "Amount must be positive." }),
  paymentDate: z.string().min(1, { message: "Payment date is required." }),
  remarks: z.string().optional(),
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

export default function FeePaymentsPage() {
  const [, setLocation] = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [ledger, setLedger] = useState<StudentLedger | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(
    getCurrentMonthYearString(),
  );
  const token = localStorage.getItem("authToken");

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: "",
      paymentDate: new Date().toISOString().split("T")[0],
      remarks: "",
    },
  });
  const amountToPay = form.watch("amount");

  const getToken = useCallback(() => {
    const currentToken = localStorage.getItem("authToken");
    if (!currentToken) {
      setError("Not authenticated. Redirecting to login...");
      setIsLoadingStudents(false);
      setIsLoadingLedger(false);
      setTimeout(() => setLocation("/login"), 1500);
    }
    return currentToken;
  }, [setLocation]);

  useEffect(() => {
    const fetchStudentsForDropdown = async () => {
      setIsLoadingStudents(true);
      setError(null);
      const currentToken = getToken();
      if (!currentToken) return;

      try {
        const response = await fetch("/api/students", {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Authentication failed. Please login again.");
          }
          throw new Error("Failed to fetch students");
        }
        const data: Student[] = await response.json();
        setStudents(data.sort((a, b) => a.fullName.localeCompare(b.fullName)));
      } catch (err: any) {
        console.error("Fetch Students Error:", err);
        setError("Could not load student list: " + err.message);
        if (err.message.includes("Authentication")) {
          setTimeout(() => setLocation("/login"), 1500);
        }
      } finally {
        setIsLoadingStudents(false);
      }
    };
    fetchStudentsForDropdown();
  }, [getToken, setLocation]);

  const fetchLedger = useCallback(async () => {
    if (!selectedStudentId || !selectedMonth) {
      setLedger(null);
      return;
    }
    setIsLoadingLedger(true);
    setError(null);
    setSuccessMessage(null);
    setFormError(null);
    // form.reset({ amount: "", paymentDate: new Date().toISOString().split("T")[0], remarks: "" }); // Reset is moved to onSubmit
    const currentToken = getToken();
    if (!currentToken) {
      setIsLoadingLedger(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/reports/student-ledger?studentId=${selectedStudentId}&monthYear=${selectedMonth}`,
        { headers: { Authorization: `Bearer ${currentToken}` } },
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Authentication failed. Please login again.");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load student ledger.");
      }
      setLedger(await res.json());
    } catch (err: any) {
      console.error("Fetch Ledger Error:", err);
      setError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedStudentId, selectedMonth, getToken, setLocation]); // removed 'form' from dependency

  useEffect(() => {
    if (selectedStudentId && selectedMonth) {
      fetchLedger();
    } else {
      setLedger(null);
    }
  }, [selectedStudentId, selectedMonth, fetchLedger]);

  const allocatePayment = (
    amountToAllocate: number,
    dues: LedgerDue[],
  ): {
    items: { feeHeadId: string; amountPaid: number }[];
    remaining: number;
  } => {
    const items: { feeHeadId: string; amountPaid: number }[] = [];
    let remainingAmount = amountToAllocate;
    for (const due of dues) {
      if (remainingAmount <= 0) break;
      if (due.balance > 0) {
        const amountToPayThisHead = Math.min(remainingAmount, due.balance);
        if (amountToPayThisHead > 0) {
          items.push({
            feeHeadId: due.feeHeadId,
            amountPaid: amountToPayThisHead,
          });
          remainingAmount -= amountToPayThisHead;
        }
      }
    }
    if (remainingAmount > 0.01) {
      console.warn(
        "Payment allocation resulted in remaining amount:",
        remainingAmount,
      );
    }
    return { items, remaining: remainingAmount };
  };

  const paymentAllocationPreview = useMemo(() => {
    if (
      !ledger ||
      !amountToPay ||
      typeof amountToPay !== "number" ||
      amountToPay <= 0
    ) {
      return [];
    }
    const validAmount = Math.min(amountToPay, ledger.summary.balance);
    const { items } = allocatePayment(validAmount, ledger.dues);
    return items.map((item) => {
      const dueInfo = ledger.dues.find((d) => d.feeHeadId === item.feeHeadId);
      return {
        name: dueInfo?.name || "Unknown Fee",
        amountAllocated: item.amountPaid,
      };
    });
  }, [amountToPay, ledger]);

  const onSubmit = async (data: PaymentFormData) => {
    if (!ledger || !selectedStudentId || !selectedMonth) {
      setFormError("Please select a student and month first.");
      return;
    }
    if (data.amount > ledger.summary.balance + 0.01) {
      form.setError("amount", {
        type: "manual",
        message: "Payment cannot exceed balance.",
      });
      return;
    }
    if (data.amount < 0.01) {
      form.setError("amount", {
        type: "manual",
        message: "Payment amount must be positive.",
      });
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setSuccessMessage(null);
    setError(null);

    const { items } = allocatePayment(data.amount, ledger.dues);

    if (items.length === 0) {
      setFormError("Could not allocate payment (check balance/dues).");
      setIsSaving(false);
      return;
    }

    const currentToken = getToken();
    if (!currentToken) {
      setIsSaving(false);
      return;
    }

    const student = students.find((s) => s._id === selectedStudentId);
    if (!student?.classId?._id) {
      setFormError("Could not determine student's class. Please refresh.");
      setIsSaving(false);
      return;
    }

    const payload = {
      studentId: selectedStudentId,
      classId: student.classId._id,
      monthYear: selectedMonth,
      totalAmountPaid: data.amount,
      items: items,
      remarks: data.remarks,
      paymentDate: new Date(data.paymentDate).toISOString(),
    };

    try {
      const response = await fetch("/api/fees/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Authentication failed. Please log in again.");
        }
        throw new Error(result.message || "Failed to record payment.");
      }
      setSuccessMessage(
        `Payment of ${formatCurrency(data.amount)} recorded successfully!`,
      );
      // Reset form on success
      form.reset({
        amount: "",
        paymentDate: new Date().toISOString().split("T")[0],
        remarks: "",
      });
      fetchLedger(); // Refresh the ledger
    } catch (err: any) {
      console.error("Record Payment Error:", err);
      setFormError(err.message);
      if (err.message.includes("Authentication")) {
        setTimeout(() => setLocation("/login"), 1500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">
          Record Fee Payment
        </h2>
        <Button variant="link" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>

      {/* --- Filters --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="student-select">Select Student:</Label>
          <Select
            value={selectedStudentId}
            onValueChange={(value) => {
              console.log("[DEBUG] Setting selectedStudentId:", value);
              setSelectedStudentId(value);
            }}
            disabled={isLoadingStudents || students.length === 0}
          >
            <SelectTrigger className="h-10 w-full mt-1" id="student-select">
              <SelectValue
                placeholder={
                  isLoadingStudents ? "Loading..." : "Select student..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              {students.length === 0 && !isLoadingStudents ? (
                <p className="p-2 text-sm text-muted-foreground">
                  No students found.
                </p>
              ) : (
                students.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.fullName} {s.rollNumber && `(${s.rollNumber})`} -{" "}
                    {s.classId?.name || "N/A"}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="payment-month">Payment For Month:</Label>
          <Input
            type="month"
            id="payment-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={isLoadingStudents || isLoadingLedger || isSaving}
            className="h-10 w-full mt-1"
          />
        </div>
      </div>

      {/* --- General Error --- */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* --- Ledger Display & Payment Form --- */}
      {selectedStudentId && (
        <>
          {isLoadingLedger && (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading ledger...</span>
            </div>
          )}

          {!isLoadingLedger && !ledger && !error && (
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ledger Not Found</AlertTitle>
              <AlertDescription>
                Could not load financial details. Ensure fee structures are set.
              </AlertDescription>
            </Alert>
          )}

          {!isLoadingLedger && ledger && (
            <div className="space-y-6">
              {/* --- Summary --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border rounded-lg p-4 shadow-sm">
                  <div className="text-sm font-medium text-muted-foreground">
                    Total Due
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(ledger.summary.totalDue)}
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-4 shadow-sm">
                  <div className="text-sm font-medium text-muted-foreground">
                    Total Paid
                  </div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(ledger.summary.totalPaid)}
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-4 shadow-sm">
                  <div
                    className={`text-sm font-medium ${ledger.summary.balance > 0 ? "text-destructive" : "text-green-600"}`}
                  >
                    Balance
                  </div>
                  <div
                    className={`text-2xl font-bold ${ledger.summary.balance > 0 ? "text-destructive" : "text-green-600"}`}
                  >
                    {formatCurrency(ledger.summary.balance)}
                  </div>
                </div>
              </div>

              {/* --- Feedback Area --- */}
              {successMessage && (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Payment Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              {/* --- Payment Form --- */}
              {ledger.summary.balance > 0 && (
                <div className="border rounded-lg p-4 space-y-3 bg-card shadow-sm">
                  <h3 className="text-xl font-medium">Record New Payment</h3>
                  {/* THIS IS THE LINE THAT WAS CAUSING THE CRASH (Line 540 approx) */}
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount to Pay (PKR) *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder={`Balance: ${ledger.summary.balance.toLocaleString()}`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="paymentDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Date *</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="remarks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Remarks (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="e.g., Paid by father..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Allocation Preview */}
                      {paymentAllocationPreview.length > 0 && (
                        <div className="text-sm space-y-1 pt-2">
                          <p className="font-medium text-muted-foreground">
                            Payment will be allocated as:
                          </p>
                          <ul className="list-disc list-inside pl-4">
                            {paymentAllocationPreview.map((item) => (
                              <li key={item.name}>
                                <span className="font-semibold">
                                  {item.name}:
                                </span>{" "}
                                {formatCurrency(item.amountAllocated)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                              Recording...
                            </>
                          ) : (
                            <>
                              <Receipt size={18} className="mr-2" /> Record
                              Payment
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
              {/* Show message if balance is zero or less */}
              {ledger.summary.balance <= 0 && (
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Fees Cleared</AlertTitle>
                  <AlertDescription>
                    No outstanding balance for this student for the selected
                    month.
                  </AlertDescription>
                </Alert>
              )}

              {/* --- Dues & Payments Tables --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dues */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium">
                    Monthly Dues Breakdown
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fee Head</TableHead>
                          <TableHead className="text-right">Due</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.dues.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                              No fee structure set.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ledger.dues.map((due) => (
                            <TableRow key={due.feeHeadId}>
                              <TableCell className="font-medium">
                                {due.name}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(due.due)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(due.paid)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-bold ${due.balance > 0 ? "text-destructive" : "text-green-600"}`}
                              >
                                {formatCurrency(due.balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Payment History */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium">
                    Payment History (This Month)
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">
                            Amount Paid
                          </TableHead>
                          <TableHead>Received By</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.payments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                              No payments recorded.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ledger.payments.map((p) => (
                            <TableRow key={p._id}>
                              <TableCell>
                                {new Date(p.paymentDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(p.totalAmountPaid)}
                              </TableCell>
                              <TableCell>
                                {p.receivedBy?.fullName || "N/A"}
                              </TableCell>
                              <TableCell>{p.remarks || "-"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Back Link */}
      <div className="mt-6 pt-4 border-t">
        <Button variant="link" className="p-0 h-auto" asChild>
          <Link href="/dashboard">&larr; Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
