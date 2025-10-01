// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- Logique de Routage ---
import PrivateRoute from './routes/PrivateRoute';
import RoleBasedRedirect from './routes/RoleBasedRedirect';

// --- Layouts et Pages Publiques ---
import AdminLayout from './layout/AdminLayout';
import CommercialLayout from './layout/CommercialLayout';
import DirecteurLayout from './layout/DirecteurLayout';
import Login from './pages/auth/Login';
import SetupPassword from './pages/auth/SetupPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import SelectCommercialPage from './pages/auth/CommercialSelectionPage';
import HistoriquePage from './pages/commercial/Historique';
// --- Pages Admin ---
// ... (imports admin inchangés) ...
import DashboardAdmin from './pages/admin/Dashboard/DashboardAdmin';
import DirecteursPage from './pages/admin/directeurs/DirecteursPage';
import DirecteurDetailsPage from './pages/admin/directeurs/DirecteurDetailsPage';
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
import CommercialTranscriptionPage from './pages/admin/transcriptions/CommercialTranscriptionPage';
import ReportsPage from './pages/admin/rapports/ReportsPage';
import ParametresPage from './pages/admin/parametres/ParametresPage';

// --- Pages Commercial ---
import CommercialDashboardPage from './pages/commercial/dashboard/DashboardCommercial';
import ProspectingSetupPage from './pages/commercial/prospection/ProspectingSetupPage'; 
import ProspectingDoorsPage from './pages/commercial/prospection/ProspectingDoorsPage';
import CommercialImmeublesPage from './pages/commercial/immeubles/CommercialImmeublesPage'; // Import the new page
import CommercialStatisticsPage from './pages/commercial/statistics/StatisticsPage';
import RendezVousPage from './pages/commercial/rendez-vous/RendezVousPage';


// --- Pages des autres Rôles (pour l'exemple) ---
import ManagerLayout from './layout/ManagerLayout';
import DashboardManager from './pages/manager/dashboard/DashboardManager';
import ManagerCommerciauxPage from './pages/manager/commericial/CommerciauxPage';
import ManagerEquipesPage from './pages/manager/equipe/EquipesPage';
import ManagerCommercialDetailsPage from './pages/manager/commericial/CommercialDetailsPage';
import ManagerEquipeDetailsPage from './pages/manager/equipe/EquipeDetailsPage';
import ManagerImmeublesPage from './pages/manager/immeubles/ImmeublesPage';
import ManagerImmeubleDetailsPage from './pages/manager/immeubles/portes/ImmeubleDetailsPage';
import ManagerSuiviPage from './pages/manager/suivi/SuiviPage';
import ManagerTranscriptionsPage from './pages/manager/transcription/TranscriptionsPage';
import ManagerCommercialTranscriptionPage from './pages/manager/transcription/CommercialTranscriptionPage';
import DashboardDirecteur from './pages/directeur/Dashboard/DashboardDirecteur';
import DirecteurManagersPage from './pages/directeur/managers/ManagersPage';
import DirecteurManagerDetailsPage from './pages/directeur/managers/ManagerDetailsPage';
import DirecteurEquipesPage from './pages/directeur/equipes/EquipesPage';
import DirecteurEquipeDetailsPage from './pages/directeur/equipes/EquipeDetailsPage';
import DirecteurCommerciauxPage from './pages/directeur/commerciaux/CommerciauxPage';
import DirecteurCommercialDetailsPage from './pages/directeur/commerciaux/CommercialDetailsPage';
import DirecteurStatistiquesPage from './pages/directeur/statistiques/StatistiquesPage';
import DirecteurGPSTrackingPage from './pages/directeur/gps-tracking/GPSTrackingPage';
import DashboardBackoffice from './pages/backoffice/DashboardBackoffice';
import ManagerGPSPage from './pages/manager/gps/gps_suivi';
import ManagerZonesPage from './pages/manager/zones/ZonesPage';
import ManagerZoneDetailsPage from './pages/manager/zones/ZoneDetailsPage';
import ManagerStatisticsPage from './pages/manager/statitistiques/StatistiquesPage';


import { Toaster } from "sonner";
import SelectBuildingPage from './pages/commercial/prospection/SelectBuildingPage';
import ManagerAssignmentGoalsPage from './pages/manager/assignment-goals/AssignmentGoalsPage';
import ManagerProfilePage from './pages/manager/profile/ManagerProfilePage';


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
            <Route path="directeurs" element={<DirecteursPage />} />
            <Route path="directeurs/:id" element={<DirecteurDetailsPage />} />
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
            <Route path="transcriptions/:commercialId" element={<CommercialTranscriptionPage />} />
            <Route path="rapports" element={<ReportsPage />} />
            <Route path="assignations-objectifs" element={<AssignmentGoalsPage />} />
            <Route path="parametres" element={<ParametresPage />} />
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
            <Route path="rendez-vous" element={<RendezVousPage />} />
          </Route>

          {/* --- Layout pour les managers --- */}
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<DashboardManager />} />
            <Route path="commerciaux" element={<ManagerCommerciauxPage />} />
            <Route path="commerciaux/:id" element={<ManagerCommercialDetailsPage />} />
            <Route path="equipes" element={<ManagerEquipesPage />} />
            <Route path="equipes/:id" element={<ManagerEquipeDetailsPage />} />
            <Route path="immeubles" element={<ManagerImmeublesPage />} />
            <Route path="immeubles/:immeubleId" element={<ManagerImmeubleDetailsPage />} />
            <Route path="suivi" element={<ManagerSuiviPage />} />
            <Route path="transcriptions" element={<ManagerTranscriptionsPage />} />
            <Route path="transcriptions/:commercialId" element={<ManagerCommercialTranscriptionPage />} />
            <Route path="gps-tracking" element={<ManagerGPSPage />} />
            <Route path="zones" element={<ManagerZonesPage />} />
            <Route path="zones/:zoneId" element={<ManagerZoneDetailsPage />} />
            <Route path="assignations-objectifs" element={<ManagerAssignmentGoalsPage />} />
            <Route path="statistiques" element={<ManagerStatisticsPage />} />
            <Route path="profile" element={<ManagerProfilePage />} />

          </Route>
            
                  {/* --- Layout pour les directeurs --- */}
                  <Route path="/directeur" element={<DirecteurLayout />}>
                    <Route index element={<DashboardDirecteur />} />
                    <Route path="dashboard" element={<DashboardDirecteur />} />
                    <Route path="managers" element={<DirecteurManagersPage />} />
                    <Route path="managers/:managerId" element={<DirecteurManagerDetailsPage />} />
                    <Route path="equipes" element={<DirecteurEquipesPage />} />
                    <Route path="equipes/:equipeId" element={<DirecteurEquipeDetailsPage />} />
                    <Route path="commerciaux" element={<DirecteurCommerciauxPage />} />
                    <Route path="commerciaux/:id" element={<DirecteurCommercialDetailsPage />} />
                    <Route path="statistiques" element={<DirecteurStatistiquesPage />} />
                    <Route path="gps-tracking" element={<DirecteurGPSTrackingPage />} />
                    {/* Routes supplémentaires pour le directeur seront ajoutées ici */}
                  </Route>

          {/* Routes pour les autres rôles */}
          <Route path="/backoffice" element={<DashboardBackoffice />} />

        </Route>

        <Route path="*" element={<div>Page non trouvée</div>} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

export default App;
