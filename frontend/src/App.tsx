import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PropertyList from './components/PropertyList'
import NewPropertyForm from './components/PropertyForm'
import EditPropertyForm from './components/EditPropertyForm'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PropertyList />} />
        <Route path="/new" element={<NewPropertyForm />} />
        <Route path="/edit/:id" element={<EditPropertyForm />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App