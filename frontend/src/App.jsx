import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import BusinessDetail from "./pages/BusinessDetail";
import { ThemeProvider } from "@/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/business/:id" element={<BusinessDetail />} />
      </Routes>
    </ThemeProvider>
  );
}
