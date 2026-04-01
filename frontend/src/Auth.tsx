import { useState } from "react";
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const userEmail = email.includes("@") ? email : `${email}@localhost`;

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: userEmail,
          password,
        });

        if (error) throw error;

        const usernameFromEmail = email.split("@")[0];
        setUsername(usernameFromEmail);

        const syncResponse = await fetch(`${API_URL}/api/auth/sync-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usernameFromEmail, password }),
        });

        if (syncResponse.ok) {
          setMessage("Account created and synced to Prosody!");
        } else {
          setMessage("Account created but sync failed. Please try logging in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password,
        });

        if (error) throw error;

        const usernameFromEmail = email.split("@")[0];

        const syncResponse = await fetch(`${API_URL}/api/auth/sync-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usernameFromEmail, password }),
        });

        if (syncResponse.ok) {
          setMessage("Logged in and synced to Prosody!");
        } else {
          setMessage("Logged in but sync failed.");
        }
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">
        {isSignUp ? "Sign Up with Supabase" : "Login with Supabase"}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email / Username</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="alice or alice@localhost"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Processing..." : isSignUp ? "Sign Up" : "Login"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="w-full mt-4 text-sm text-blue-500 hover:underline"
      >
        {isSignUp ? "Already have an account? Login" : "Don't have an account? Sign Up"}
      </button>
      {message && (
        <p className="mt-4 text-center text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
}