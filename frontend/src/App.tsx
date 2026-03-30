import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
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
        <Route path="/party" element={<PartyPage />} />
        <Route path="/party/:code" element={<PartyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
