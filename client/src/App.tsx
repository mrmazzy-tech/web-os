import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import StudentsPage from "@/pages/StudentsPage";
import FeeSummaryPage from "@/pages/FeeSummaryPage";
// ... other page imports ...
import TeachersPage from "@/pages/TeachersPage";
import AttendancePage from "@/pages/AttendancePage";
import FeeStructurePage from "@/pages/FeeStructurePage";
import FeePaymentsPage from "@/pages/FeePaymentsPage";
import ReportsPage from "@/pages/ReportsPage";
import ManageClassesPage from "@/pages/ManageClassesPage";
// --- IMPORT THE NEW WIZARD PAGES (we will create these next) ---
import SetupStep1Page from "@/pages/setup/SetupStep1Page";
import SetupStep2Page from "@/pages/setup/SetupStep2Page";
import SetupStep3Page from "@/pages/setup/SetupStep3Page";
import ManageExamsPage from "@/pages/academics/ManageExamsPage";
import EnterMarksPage from "@/pages/academics/EnterMarksPage";
import ReportCardPage from "@/pages/academics/ReportCardPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";

function Router() {
  return (
    <Switch>
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/pending-approval" component={PendingApprovalPage} />
      {/* --- ADD NEW SETUP WIZARD ROUTES --- */}
      <Route path="/setup/step-1" component={SetupStep1Page} />
      <Route path="/setup/step-2" component={SetupStep2Page} />
      <Route path="/setup/step-3" component={SetupStep3Page} />
      {/* --- END NEW ROUTES --- */}

      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/students" component={StudentsPage} />
      <Route path="/dashboard/teachers" component={TeachersPage} />
      <Route path="/dashboard/attendance" component={AttendancePage} />
      <Route path="/dashboard/fees/structure" component={FeeStructurePage} />
      <Route path="/dashboard/fees/payments" component={FeePaymentsPage} />
      <Route path="/dashboard/fees/summary" component={FeeSummaryPage} />
      <Route path="/dashboard/reports" component={ReportsPage} />
      {/* --- ADD NEW ACADEMICS ROUTE --- */}
      <Route path="/dashboard/academics/exams" component={ManageExamsPage} />
      <Route path="/dashboard/academics/marks" component={EnterMarksPage} />
      <Route path="/dashboard/classes" component={ManageClassesPage} />
      <Route
        path="/dashboard/academics/report-card"
        component={ReportCardPage}
      />

      <Route path="/">
        <Redirect to="/login" />
      </Route>
      {/* <Route> 404 Not Found! </Route> */}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
