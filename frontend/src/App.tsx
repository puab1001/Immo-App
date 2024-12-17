import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PropertyList from './components/PropertyList'
import NewPropertyForm from './components/PropertyForm'
import EditPropertyForm from './components/EditPropertyForm'


function App() {
  return (
    <BrowserRouter>
    
        <Sidebar>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<div className="text-lg">Dashboard (Coming Soon)</div>} />
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/new" element={<NewPropertyForm />} />
            <Route path="/edit/:id" element={<EditPropertyForm />} />
            <Route path="/settings" element={<div className="text-lg">Einstellungen (Coming Soon)</div>} />
            </Routes>
        </Sidebar>
     
    </BrowserRouter>
  )
}

export default App