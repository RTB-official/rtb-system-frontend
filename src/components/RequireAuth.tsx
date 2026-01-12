// src/components/RequireAuth.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/auth"; // ✅ @/store/auth → 상대경로

export default function RequireAuth() {
  const { loading, user } = useAuth();

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
