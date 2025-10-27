import "./index.css";
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 p-8">
      <div className="w-full max-w-[1600px] mx-auto bg-white rounded-3xl shadow-2xl border border-gray-200 p-10">
        <Dashboard />
      </div>
    </div>
  );
}

export default App;
