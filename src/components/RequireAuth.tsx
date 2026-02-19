// src/components/RequireAuth.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth"; // ✅ @/store/auth → 상대경로
import AuthSkeleton from "./common/AuthSkeleton";

export default function RequireAuth() {
  const { loading, loadingProfile, user, profile } = useAuth();
  const location = useLocation();

  if (loading || loadingProfile) return <AuthSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!profile) return <AuthSkeleton />;

  return <Outlet />;
}




