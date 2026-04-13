import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';

export default function AppLayout() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Sidebar />
      <div className="ml-56">
        <Topbar />
        <main className="p-6 mx-auto" style={{ maxWidth: '1400px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
