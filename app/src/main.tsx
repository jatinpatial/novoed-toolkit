import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import InfographicStudio from "./pages/InfographicStudio";
import CreateInfographicPage from "./pages/CreateInfographicPage";
import CreateInfographicPromptPage from "./pages/CreateInfographicPromptPage";
import ComponentCatalogLegacy from "./pages/ComponentCatalogLegacy";
import CourseStudio from "./pages/CourseStudio";
import CreateCoursePage from "./pages/CreateCoursePage";
import CreateScriptPage from "./pages/CreateScriptPage";
import ScriptStudio from "./pages/ScriptStudio";
import CreateKcPage from "./pages/CreateKcPage";
import KcStudio from "./pages/KcStudio";
import ScormPlayer from "./pages/ScormPlayer";
import ProjectsLibrary from "./pages/ProjectsLibrary";
import { BrandBodyAttribute } from "./shell/TopBar";
import { AgentProvider } from "./agent/AgentContext";
import "./index.css";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

/**
 * AgentProvider hoist (CRITICAL bug fix — WebSocket-dropping during
 * agent activity).
 *
 * Pre-hoist, every protected route wrapped its own <AgentProvider>.
 * Each provider instance owned its own WebSocket. Navigating between
 * pages mounted a NEW provider with a NEW socket, closing the prior
 * one. If an agent tool call was in flight at navigation time (e.g.
 * an LD clicked "Build infographic" on a module → navigated to
 * /infographics/prompt → clicked Generate), the agent's response
 * landed on a closed socket and was dropped. Symptoms: lessons
 * marked failed despite real content present; infographics stuck on
 * "no points yet" forever.
 *
 * Post-hoist: one <AgentProvider> wraps every route. One WebSocket
 * for the whole app, persists across navigation. Agent tool results
 * always reach a live socket regardless of which page the LD is on.
 *
 * StrictMode is REMOVED in dev because it double-mounts effects,
 * which means the AgentProvider's WebSocket connect effect fires
 * twice on first mount. The second connect closes the first; the
 * cleanup of the first run then closes the second. End state is fine
 * but the closed-twice warnings spam the console and obscure real
 * issues. Production isn't affected (StrictMode is dev-only).
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={basename}>
    {/* B3d: keeps <body data-brand="..."> in sync with the active
        brand from useActiveBrand(). The cascade vars defined in
        src/index.css ([data-brand="..."] selectors) flow to any
        surface that reads them — currently the .lesson-canvas-pane
        top accent strip, future surfaces opt in via var(--brand-500).
        Renders nothing; pure side-effect component. */}
    <BrandBodyAttribute />
    <AgentProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* Track-SS (Deckster-style): Quick Prompt Infographic. */}
        <Route path="/infographics/prompt" element={<CreateInfographicPromptPage />} />
        <Route path="/infographics/new" element={<CreateInfographicPage />} />
        <Route path="/infographics/:id" element={<InfographicStudio />} />
        {/* Legacy components-catalog editor — kept under /infographics
            for backward compat with component-kind projects. */}
        <Route path="/infographics" element={<ComponentCatalogLegacy />} />
        <Route path="/courses" element={<CourseStudio />} />
        <Route path="/courses/new" element={<CreateCoursePage />} />
        <Route path="/scripts/new" element={<CreateScriptPage />} />
        <Route path="/scripts/:id" element={<ScriptStudio />} />
        <Route path="/kcs/new" element={<CreateKcPage />} />
        <Route path="/kcs/:id" element={<KcStudio />} />
        <Route path="/player" element={<ScormPlayer />} />
        <Route path="/projects" element={<ProjectsLibrary />} />
        {/* Legacy routes */}
        <Route path="/course-builder" element={<Navigate to="/courses" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AgentProvider>
  </BrowserRouter>,
);
