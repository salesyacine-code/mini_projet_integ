import { Routes, Route } from "react-router-dom";
import Sources from "./pages/Sources";
import Content from "./pages/Content";
import Queries from "./pages/Queries";
import Layout from "./Layout/Layout";

export default function App() {
  return (
    // This <Routes> block is mandatory!
    <Routes>
      <Route element={<Layout />}>
        {/* These are nested routes */}
        <Route index element={<Sources />} /> 
        <Route path="/sources" element={<Sources />} />
        <Route path="/content" element={<Content />} />
        <Route path="/queries" element={<Queries />} />
      </Route>
    </Routes>
  );
}