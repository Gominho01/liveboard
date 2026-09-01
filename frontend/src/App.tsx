import { LoginForm } from "./components/LoginForm";
import { useAuthStore } from "./store/auth";
import "./App.css";

function App() {
  const token = useAuthStore((s) => s.token);

  return token ? <p>Logged in.</p> : <LoginForm />;
}

export default App;
