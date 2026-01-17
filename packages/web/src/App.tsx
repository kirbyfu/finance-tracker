import { trpc } from './lib/trpc';

function App() {
  const { data: sources, isLoading } = trpc.sources.list.useQuery();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-4">Finance Tracker</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <p>Sources: {sources?.length ?? 0}</p>
      )}
    </div>
  );
}

export default App;
