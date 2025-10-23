import ItemsByRevenue from './components/ItemsByRevenue'
import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800">
            ☕ Campus Cafe Reporting
          </h1>
          <p className="text-gray-600 mt-2">Sales Analytics Dashboard</p>
        </header>
        
        <ItemsByRevenue />
      </div>
    </div>
  )
}

export default App
