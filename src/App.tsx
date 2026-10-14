import React from 'react';
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
import ExecutionPage from './f6/ExecutionPage';
import UsersPage from './pages/UsersPage';

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
            <Route element={<AppLayout />}>
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectPage />} />
              <Route path="/projects/:id/sections/:kind" element={<SectionEditorPage />} />
              <Route path="/executions/:id" element={<ExecutionPage />} />
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
