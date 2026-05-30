import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/toast";
import Layout from "./components/layout";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Sources from "./pages/sources";
import Notices from "./pages/notices";
import SettingsPage from "./pages/settings";
import Runs from "./pages/runs";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/w/:wsId" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="sources" element={<Sources />} />
            <Route path="notices" element={<Notices />} />
            <Route path="runs" element={<Runs />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
