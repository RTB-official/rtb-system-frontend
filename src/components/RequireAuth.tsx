// src/components/RequireAuth.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/auth"; // ✅ @/store/auth → 상대경로
import AuthSkeleton from "./common/AuthSkeleton";

export default function RequireAuth() {
  const { loading, loadingProfile, user, profile } = useAuth();

  if (loading || loadingProfile) return <AuthSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <AuthSkeleton />;

  return <Outlet />;
}




