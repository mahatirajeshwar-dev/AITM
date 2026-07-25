import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import ListingDetails from './pages/ListingDetails';
import CreateListing from './pages/CreateListing';
import { Login, Signup, VerifyEmail, ForgotPassword, ResetPassword, AdminLogin } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import TransactionDetail from './pages/TransactionDetail';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Safety from './pages/Safety';
import Admin from './pages/Admin';

function Protected({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useApp();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={admin ? '/admin/login' : '/login'} state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/listing/:id" element={<ListingDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<Protected><VerifyEmail /></Protected>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/create" element={<Protected><CreateListing /></Protected>} />
          <Route path="/edit/:id" element={<Protected><CreateListing edit /></Protected>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/transactions/:id" element={<Protected><TransactionDetail /></Protected>} />
          <Route path="/messages" element={<Protected><Messages /></Protected>} />
          <Route path="/messages/:id" element={<Protected><Messages /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<div className="card p-12 text-center"><h2 className="text-xl font-bold">Page not found</h2></div>} />
        </Routes>
      </Layout>
    </AppProvider>
  );
}
