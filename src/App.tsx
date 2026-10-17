import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { DecimalsProvider } from './context/DecimalsContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectPage from './f6/ProjectPage';
import SectionEditorPage from './f6/SectionEditorPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import UsersPage from './pages/UsersPage';

// Ejecuciones de la versión anterior (solo lectura): chunk aparte.
const LegacyExecutionPage = lazy(() => import('./legacy/LegacyExecutionPage'));

// Las páginas con gráficos (ECharts) se cargan al abrirlas: no pesan en el resto de la app.
const ExecutionPage = lazy(() => import('./f6/ExecutionPage'));
const PrintReportPage = lazy(() => import('./f6/PrintReportPage'));
const cargando = <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <DecimalsProvider>
      <AuthProvider>
        <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            {/* Reporte para imprimir o guardar como PDF: sin la barra lateral. */}
            <Route path="/executions/:id/print" element={<Suspense fallback={cargando}><PrintReportPage /></Suspense>} />
            <Route element={<AppLayout />}>
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectPage />} />
              <Route path="/projects/:id/sections/:kind" element={<SectionEditorPage />} />
              <Route path="/executions/:id" element={<Suspense fallback={cargando}><ExecutionPage /></Suspense>} />
              <Route
                path="/legacy-executions/:id"
                element={
                  <Suspense fallback={<LoadingSpinner size="lg" />}>
                    <LegacyExecutionPage />
                  </Suspense>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute requireAdmin>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
        </ErrorBoundary>
      </AuthProvider>
      </DecimalsProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
