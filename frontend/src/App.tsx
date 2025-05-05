// src/App.tsx - Überarbeitete Version
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Providers } from "@/components/providers"
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import PropertyList from './components/Immobilien/PropertyList'
import PropertyForm from './components/Immobilien/PropertyForm'
import EditPropertyWrapper from './components/Immobilien/EditPropertyWrapper'
import TenantList from './components/Mieter/TenantList'
import TenantForm from './components/Mieter/TenantForm'
import TenantEditWrapper from './components/Mieter/TenantEditWrapper'
import DocumentList from './components/Dokumente/DocumentList'
import DocumentDetail from './components/Dokumente/DocumentDetail'
import DocumentUpload from './components/Dokumente/DocumentUpload'
import WorkerList from './components/Mitarbeiter/WorkerList'
import WorkerForm from './components/Mitarbeiter/WorkerForm'
import WorkerEditWrapper from './components/Mitarbeiter/WorkerEditWrapper'
function App() {
  return (
    <Providers>
      <BrowserRouter>
        {/* Wichtig: Sidebar bleibt beim Routing bestehen */}
        <Sidebar>
          <Routes>
            {/* Hier die statischen Routen definieren */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Property Routes - sortiere sie richtig */}
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/properties/new" element={<PropertyForm />} />
            <Route path="/properties/edit/:id" element={<EditPropertyWrapper />} />
            
           {/* Tenant Routes */}
           <Route path="/tenants" element={<TenantList />} />
            <Route path="/tenants/new" element={<TenantForm />} />
            <Route path="/tenants/edit/:id" element={<TenantEditWrapper />} />
            
            {/* Document Routes */}
            <Route path="/documents" element={<DocumentList />} />
            <Route path="/documents/upload" element={<DocumentUpload />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            
            {/* Worker Routes */}
            <Route path="/workers" element={<WorkerList />} />
            <Route path="/workers/new" element={<WorkerForm />} />
            <Route path="/workers/edit/:id" element={<WorkerEditWrapper />} />
            
            {/* Settings */}
            <Route path="/settings" element={<div>Einstellungen (Coming Soon)</div>} />
          </Routes>
        </Sidebar>
      </BrowserRouter>
    </Providers>
  )
}

export default App