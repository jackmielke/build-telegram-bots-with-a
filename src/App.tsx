import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Communities from "./pages/Communities";
import ExploreCommunities from "./pages/ExploreCommunities";
import CommunityDashboard from "./pages/CommunityDashboard";
import UserProfile from "./pages/UserProfile";
import ClaimProfile from "./pages/ClaimProfile";
import TemplateMarketplace from "./pages/TemplateMarketplace";
import ProductRoadmap from "./pages/ProductRoadmap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RecoveryRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('type=recovery') && location.pathname !== '/reset-password') {
        navigate(`/reset-password${hash}`, { replace: true });
      }
    }
  }, [location.pathname, navigate]);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RecoveryRedirect />
        <Routes>
          <Route path="/" element={<Navigate to="/communities" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/explore" element={<ExploreCommunities />} />
          <Route path="/templates" element={<TemplateMarketplace />} />
          <Route path="/roadmap" element={<ProductRoadmap />} />
          <Route path="/community/:communityId" element={<CommunityDashboard />} />
          <Route path="/user/:userId" element={<UserProfile />} />
          <Route path="/claim/:code" element={<ClaimProfile />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
