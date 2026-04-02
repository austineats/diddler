import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

const VISITOR_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

function TrackPageView() {
  const location = useLocation();
  useEffect(() => {
    fetch("/api/blind-date/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "visit",
        path: location.pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => {});
  }, [location.pathname]);

  // Heartbeat for live visitor tracking
  useEffect(() => {
    const ping = () => {
      fetch("/api/blind-date/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: VISITOR_ID, path: location.pathname }),
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return null;
}

import { DashboardPage } from "./pages/DashboardPage";
import { CreateAgentPage } from "./pages/CreateAgentPage";
import { AgentPage } from "./pages/AgentPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { BlindDatePage } from "./pages/BlindDatePage";
import { SignupPage } from "./pages/SignupPage";
import { FormPage } from "./pages/FormPage";
import { AdminPage } from "./pages/AdminPage";
import { PartyPage } from "./pages/PartyPage";
import { InvitePage } from "./pages/InvitePage";
import { JoinPage } from "./pages/JoinPage";
import { SignInPage } from "./pages/SignInPage";
import { DoublesPage } from "./pages/DoublesPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <TrackPageView />
      <Routes>
        <Route path="/" element={<BlindDatePage />} />
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/create" element={<CreateAgentPage />} />
        <Route path="/agent/:id" element={<AgentPage />} />
        <Route path="/blind-date" element={<BlindDatePage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/form" element={<FormPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/doubles" element={<DoublesPage />} />
        <Route path="/party" element={<PartyPage />} />
        <Route path="/party/:code" element={<PartyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
