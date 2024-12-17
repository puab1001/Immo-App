import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PropertyList from './components/PropertyList'
import PropertyForm from './components/PropertyForm'
import EditPropertyWrapper from './components/EditPropertyWrapper' // Neu importiert

function App() {
  return (
    <BrowserRouter>
      <Sidebar>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<div>Dashboard (Coming Soon)</div>} />
          <Route path="/properties" element={<PropertyList />} />
          <Route path="/new" element={<PropertyForm />} />
          <Route path="/edit/:id" element={<EditPropertyWrapper />} /> {/* Hier den Wrapper verwenden */}
          <Route path="/settings" element={<div>Einstellungen (Coming Soon)</div>} />
        </Routes>
      </Sidebar>
    </BrowserRouter>
  )
}

export default App