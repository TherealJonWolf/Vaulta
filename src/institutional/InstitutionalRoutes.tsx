import { Routes, Route, Navigate } from "react-router-dom";
import { InstitutionalLayout } from "./components/InstitutionalLayout";
import InstitutionalDashboard from "./pages/InstitutionalDashboard";
import InstitutionalIntake from "./pages/InstitutionalIntake";
import InstitutionalActivity from "./pages/InstitutionalActivity";
import InstitutionalReporting from "./pages/InstitutionalReporting";
import InstitutionalSettings from "./pages/InstitutionalSettings";

export const InstitutionalRoutes = () => (
  <InstitutionalLayout>
    <Routes>
      <Route path="dashboard" element={<InstitutionalDashboard />} />
      <Route path="intake" element={<InstitutionalIntake />} />
      <Route path="activity" element={<InstitutionalActivity />} />
      <Route path="reporting" element={<InstitutionalReporting />} />
      <Route path="settings" element={<InstitutionalSettings />} />
      <Route path="*" element={<Navigate to="/institutional/dashboard" replace />} />
    </Routes>
  </InstitutionalLayout>
);
