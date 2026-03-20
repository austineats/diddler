import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WaitlistPage } from "./pages/WaitlistPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateAgentPage } from "./pages/CreateAgentPage";
import { AgentPage } from "./pages/AgentPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WaitlistPage />} />
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/create" element={<CreateAgentPage />} />
        <Route path="/agent/:id" element={<AgentPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
