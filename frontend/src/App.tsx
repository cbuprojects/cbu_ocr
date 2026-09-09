import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import LoginPage from './components/login';

// ── User pages ──
import HomePage from './components/home';
// import UploadPage    from './components/user_pages/upload';
import MyUploadsPage from './components/user_pages/user_file_uploads';

// ── Admin: OCR monitoring ──
// import InternalUploadsPage  from './components/admin_pages/internal_uploads';
// import ExternalRequestsPage from './components/admin_pages/external_requests';
// import OcrStatusPage        from './components/admin_pages/ocr_status';

// ── Admin: users ──
// import AdminUsersPage    from './components/admin_pages/users_data';
// import UserSessionsPage  from './components/admin_pages/user_sessions';
// import UserActionsPage   from './components/admin_pages/user_actions';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Returns true when a session token is stored. */
const isAuthenticated = () => Boolean(localStorage.getItem('session_id'));

/**
 * Returns the Authorization header value for API calls throughout the app.
 * Usage:  fetch('/api/...', { headers: { Authorization: authHeader() } })
 */
export const authHeader = () => `Bearer ${localStorage.getItem('session_id') ?? ''}`;

/** Call this to sign out from anywhere in the app. */
export const logout = () => {
  localStorage.removeItem('session_id');
  window.location.href = '/login';
};

// ---------------------------------------------------------------------------
// ProtectedRoute
// ---------------------------------------------------------------------------

/**
 * Wraps any route that requires authentication.
 * If the user has no token they are sent to /login.
 *
 * The backend also rejects invalid / expired tokens with 401/403, so intercept
 * those in your API layer and call logout() to bounce the user back to login.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    // Preserve the attempted URL so we can redirect back after login if desired
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const App = () => {
  return (
    <Router>
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Protected routes ── */}
        {/* Home = the user's own activity stats (charts) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* User: upload a file + own OCR history */}
        {/*
        <Route path="/upload"     element={<ProtectedRoute><UploadPage />    </ProtectedRoute>} />
        */}
        <Route path="/my_uploads" element={<ProtectedRoute><MyUploadsPage /> </ProtectedRoute>} />



        {/* Admin: OCR monitoring */}
        {/*
        <Route path="/internal_uploads"  element={<ProtectedRoute><InternalUploadsPage />  </ProtectedRoute>} />
        <Route path="/external_requests" element={<ProtectedRoute><ExternalRequestsPage /> </ProtectedRoute>} />
        <Route path="/ocr_status"        element={<ProtectedRoute><OcrStatusPage />        </ProtectedRoute>} />
        */}

        {/* Admin: users data */}
        {/*
        <Route path="/users_data"    element={<ProtectedRoute><AdminUsersPage />   </ProtectedRoute>} />
        <Route path="/user_sessions" element={<ProtectedRoute><UserSessionsPage /> </ProtectedRoute>} />
        <Route path="/user_actions"  element={<ProtectedRoute><UserActionsPage />  </ProtectedRoute>} />
        */}

        {/* Fallback: unknown paths → login if unauthed, home if authed */}
        <Route
          path="*"
          element={isAuthenticated() ? <Navigate to="/" replace /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </Router>
  );
};

export default App;