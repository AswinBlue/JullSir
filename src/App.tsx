import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { CreateQueue } from './pages/CreateQueue';
import { StoreDisplay } from './pages/StoreDisplay';
import { AdminDashboard } from './pages/AdminDashboard';
import { QueueIssue } from './pages/QueueIssue';
import { TicketDetail } from './pages/TicketDetail';

export const App: React.FC = () => {
  // Respect Vite base path (e.g. /Jullsir/ on GitHub Pages)
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* Main Hub: Role selection (Host vs Guest) */}
        <Route path="/" element={<Home />} />

        {/* Host: Create Queue */}
        <Route path="/create" element={<CreateQueue />} />

        {/* Host: Store Kiosk / Tablet Display (Strictly no admin controls) */}
        <Route path="/display/:queueId" element={<StoreDisplay />} />

        {/* Host: Admin Dashboard */}
        <Route path="/admin/:adminToken" element={<AdminDashboard />} />

        {/* Guest: Online Queue Ticket Issue */}
        <Route path="/q/:queueId" element={<QueueIssue />} />

        {/* Guest: Real-time Ticket Status & Notification View */}
        <Route path="/q/:queueId/ticket/:ticketId" element={<TicketDetail />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
