import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Sources } from '@/pages/Sources';
import { Categories } from '@/pages/Categories';
import { Import } from '@/pages/Import';
import { Transactions } from '@/pages/Transactions';
import { Rules } from '@/pages/Rules';
import { Reports } from '@/pages/Reports';
import { Dashboard } from '@/pages/Dashboard';

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
