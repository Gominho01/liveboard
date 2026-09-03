import { LoginForm } from "./components/LoginForm";
import { BoardPage } from "./pages/BoardPage";
import { useAuthStore } from "./store/auth";
import "./App.css";

function App() {
  const token = useAuthStore((s) => s.token);

  return token ? <BoardPage /> : <LoginForm />;
}

export default App;
