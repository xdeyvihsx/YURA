import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { PlayerProvider } from "@/context/player";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PlayerProvider>
      <App />
    </PlayerProvider>
  </React.StrictMode>,
);
