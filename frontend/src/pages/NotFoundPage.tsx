import { useNavigate } from "react-router-dom";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-4xl font-medium text-zinc-900 mb-2">404</h1>
      <p className="text-[13px] text-zinc-400 mb-6">This page doesn't exist.</p>
      <button
        onClick={() => navigate("/")}
        className="btn-primary px-4 py-2 text-[13px] font-medium"
      >
        Go home
      </button>
    </div>
  );
}
