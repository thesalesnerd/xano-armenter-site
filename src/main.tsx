import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider, useAuth } from './auth';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Home from './pages/Home';
import NewArtist from './pages/NewArtist';
import Pieces from './pages/Pieces';
import PieceEdit from './pages/PieceEdit';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import Reports from './pages/Reports';
import ReportPrint from './pages/ReportPrint';
import Import from './pages/Import';
import Settings from './pages/Settings';
import PublicProfile from './pages/PublicProfile';
import PublicPiece from './pages/PublicPiece';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});
// Lets the app run under a sub-path when Vite's `base` is set; "/" otherwise.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/p/:slug" element={<PublicProfile />} />
            <Route path="/p/:slug/w/:pieceId" element={<PublicPiece />} />
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
            <Route path="/new" element={<RequireAuth><NewArtist /></RequireAuth>} />
            <Route path="/a/:slug" element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Navigate to="pieces" replace />} />
              <Route path="pieces" element={<Pieces />} />
              <Route path="pieces/new" element={<PieceEdit />} />
              <Route path="pieces/:pieceId" element={<PieceEdit />} />
              <Route path="collections" element={<Collections />} />
              <Route path="collections/:collectionId" element={<CollectionDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/print" element={<ReportPrint />} />
              <Route path="import" element={<Import />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
