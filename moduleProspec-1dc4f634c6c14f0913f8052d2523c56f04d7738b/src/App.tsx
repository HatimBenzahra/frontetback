// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- Logique de Routage ---
import PrivateRoute from './routes/PrivateRoute';
import RoleBasedRedirect from './routes/RoleBasedRedirect';

// --- Layouts et Pages Publiques ---
import AdminLayout from './layout/AdminLayout';
import CommercialLayout from './layout/CommercialLayout';
import Login from './pages/auth/Login';
import SetupPassword from './pages/auth/SetupPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import SelectCommercialPage from './pages/auth/CommercialSelectionPage';
import HistoriquePage from './pages/commercial/Historique';
// --- Pages Admin ---
// ... (imports admin inchangés) ...
import DashboardAdmin from './pages/admin/Dashboard/DashboardAdmin';
import ManagersPage from './pages/admin/Managers/ManagersPage';
import ManagerDetailsPage from './pages/admin/Managers/ManagerDetailsPage';
import CommerciauxPage from './pages/admin/commerciaux/CommerciauxPage';
import CommercialDetailsPage from './pages/admin/commerciaux/CommercialDetailsPage';
import EquipesPage from './pages/admin/Equipes/EquipesPage'; 
import EquipeDetailsPage from './pages/admin/Equipes/EquipeDetailsPage';
import StatistiquesPage from './pages/admin/statitistiques/StatistiquesPage';
import ZonesPage from './pages/admin/zones/ZonesPage';
import ZoneDetailsPage from './pages/admin/zones/ZoneDetailsPage'; 
import ImmeublesPage from './pages/admin/immeubles/ImmeublesPage';
import ImmeubleDetailsPage from './pages/admin/immeubles/portes/ImmeubleDetailsPage';
import SuiviPage from './pages/admin/suivi/SuiviPage';
import AssignmentGoalsPage from './pages/admin/assignment-goals/AssignmentGoalsPage';
import GPSTrackingPage from './pages/admin/gps-tracking/GPSTrackingPage';
import TranscriptionsPage from './pages/admin/transcriptions/TranscriptionsPage';

// --- Pages Commercial ---
import CommercialDashboardPage from './pages/commercial/dashboard/DashboardCommercial';
import ProspectingSetupPage from './pages/commercial/prospection/ProspectingSetupPage'; 
import ProspectingDoorsPage from './pages/commercial/prospection/ProspectingDoorsPage';
import CommercialImmeublesPage from './pages/commercial/immeubles/CommercialImmeublesPage'; // Import the new page
import CommercialStatisticsPage from './pages/commercial/statistics/StatisticsPage';


// --- Pages des autres Rôles (pour l'exemple) ---
import DashboardManager from './pages/manager/DashboardManager';
import DashboardDirecteur from './pages/directeur/DashboardDirecteur';
import DashboardBackoffice from './pages/backoffice/DashboardBackoffice';

import { Toaster } from "sonner";
import SelectBuildingPage from './pages/commercial/prospection/SelectBuildingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- Routes Publiques --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/setup-password" element={<SetupPassword />} />
        {/* NOUVELLE ROUTE PUBLIQUE POUR LA SÉLECTION */}
        <Route path="/select-commercial" element={<SelectCommercialPage />} />


        {/* --- Routes Privées Protégées --- */}
        <Route element={<PrivateRoute />}>
          
          <Route path="/" element={<RoleBasedRedirect />} />
          
          {/* --- Layout pour les administrateurs --- */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardAdmin />} />
            <Route path="managers" element={<ManagersPage />} />
            <Route path="managers/:managerId" element={<ManagerDetailsPage />} />
            <Route path="equipes" element={<EquipesPage />} /> 
            <Route path="equipes/:equipeId" element={<EquipeDetailsPage />} />
            <Route path="commerciaux" element={<CommerciauxPage />} />
            <Route path="commerciaux/:id" element={<CommercialDetailsPage />} />
            <Route path="statistiques" element={<StatistiquesPage />} />
            <Route path="zones" element={<ZonesPage />} /> 
            <Route path="zones/:zoneId" element={<ZoneDetailsPage />} /> 
            <Route path="immeubles" element={<ImmeublesPage />} />
            <Route path="immeubles/:immeubleId" element={<ImmeubleDetailsPage />} />
            <Route path="suivi" element={<SuiviPage />} />
            <Route path="gps-tracking" element={<GPSTrackingPage />} />
            <Route path="transcriptions" element={<TranscriptionsPage />} />
            <Route path="assignations-objectifs" element={<AssignmentGoalsPage />} />
          </Route>

          {/* --- Layout pour les commerciaux --- */}
          <Route path="/commercial" element={<CommercialLayout />}>
            <Route index element={<Navigate to="/commercial/dashboard" replace />} /> 
            
            <Route path="dashboard" element={<CommercialDashboardPage />} /> 
            <Route path="immeubles" element={<CommercialImmeublesPage />} /> {/* Add the new route */}

            {/* Flow de prospection */}
            <Route path="prospecting" element={<SelectBuildingPage />} />
            <Route path="prospecting/setup/:buildingId" element={<ProspectingSetupPage />} />
            <Route path="prospecting/doors/:buildingId" element={<ProspectingDoorsPage />} />

            {/* Autres pages du commercial */}
            <Route path="history" element={<HistoriquePage />} />
            <Route path="stats" element={<CommercialStatisticsPage />} />
          </Route>
            
          {/* Routes pour les autres rôles */}
          <Route path="/manager" element={<DashboardManager />} />
          <Route path="/directeur" element={<DashboardDirecteur />} />
          <Route path="/backoffice" element={<DashboardBackoffice />} />

        </Route>

        <Route path="*" element={<div>Page non trouvée</div>} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
