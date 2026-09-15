import { useState } from "react";
import { LoginForm } from "./components/LoginForm";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { BoardApp } from "./pages/BoardApp";
import { useAuthStore } from "./store/auth";
import "./App.css";

function App() {
  const token = useAuthStore((s) => s.token);
  const [initialBoardId, setInitialBoardId] = useState<string | null>(null);

  if (!token) return <LoginForm />;

  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)$/);
  if (inviteMatch) {
    return (
      <AcceptInvitePage
        inviteToken={inviteMatch[1]}
        onJoined={(boardId) => {
          window.history.replaceState({}, "", "/");
          setInitialBoardId(boardId);
        }}
      />
    );
  }

  return <BoardApp initialBoardId={initialBoardId} />;
}

export default App;
