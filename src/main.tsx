import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "./app/app";
import { AuthProvider } from "./features/auth/auth-context";
import { ChatProvider } from "./features/chat/chat-context";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <App />
          <Toaster position="top-right" richColors closeButton />
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
