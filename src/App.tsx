import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import AuthSync from "@/components/AuthSync";
import Index from "./pages/Index";
import Assessment from "./pages/Assessment";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AssessmentRoute = () => {
  const { isLoading, isAuthenticated, loginWithRedirect } = useAuth0();
  const location = useLocation();

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    void loginWithRedirect({
      appState: {
        returnTo: `${location.pathname}${location.search}`,
      },
    });
  }, [isAuthenticated, isLoading, location.pathname, location.search, loginWithRedirect]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 text-center">
        Redirecting to login...
      </div>
    );
  }

  return <Assessment />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthSync />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/assessment" element={<AssessmentRoute />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
