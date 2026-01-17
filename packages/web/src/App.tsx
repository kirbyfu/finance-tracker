import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Sources } from '@/pages/Sources';
import { Categories } from '@/pages/Categories';

// Placeholder pages
function Dashboard() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
function Transactions() {
  return <h1 className="text-2xl font-bold">Transactions</h1>;
}
function Import() {
  return <h1 className="text-2xl font-bold">Import</h1>;
}
function Reports() {
  return <h1 className="text-2xl font-bold">Reports</h1>;
}
function Rules() {
  return <h1 className="text-2xl font-bold">Rules</h1>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/import" element={<Import />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/sources" element={<Sources />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
