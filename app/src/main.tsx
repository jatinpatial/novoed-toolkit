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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      {/* B3d: keeps <body data-brand="..."> in sync with the active
          brand from useActiveBrand(). The cascade vars defined in
          src/index.css ([data-brand="..."] selectors) flow to any
          surface that reads them — currently the .lesson-canvas-pane
          top accent strip, future surfaces opt in via var(--brand-500).
          Renders nothing; pure side-effect component. */}
      <BrandBodyAttribute />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* Track-G: Infographic Studio (4th in the suite). Brief form
            + result viewer wrapped in <AgentProvider> — both use
            useAgent for the build round-trip. */}
        {/* Track-SS (Deckster-style): Quick Prompt Infographic. The
            hero entry — type a sentence, AI picks layout + content.
            Detailed brief stays available at /infographics/new for
            LDs who want surgical control. */}
        <Route path="/infographics/prompt" element={<AgentProvider><CreateInfographicPromptPage /></AgentProvider>} />
        <Route path="/infographics/new" element={<AgentProvider><CreateInfographicPage /></AgentProvider>} />
        <Route path="/infographics/:id" element={<AgentProvider><InfographicStudio /></AgentProvider>} />
        {/* Legacy components-catalog editor — kept under /infographics
            for backward compat with component-kind projects (Project
            store), but no longer surfaced in nav or suite tiles.
            Renamed at-rest to ComponentCatalogLegacy.tsx. */}
        <Route path="/infographics" element={<ComponentCatalogLegacy />} />
        <Route path="/courses" element={<CourseStudio />} />
        {/* C0: structured course-intake form. Wired from
            HeroComposer's "Detailed brief →" button. Mounted before
            the /courses route so /courses/new resolves before the
            /courses param-only route fallthrough. */}
        <Route path="/courses/new" element={<AgentProvider><CreateCoursePage /></AgentProvider>} />
        {/* polish-3c: standalone Synthesia script intake. Submits
            into a 1-module / 1-lesson / 1-video-block course that
            CourseCanvas opens with the Scriptwriter brief auto-sent.
            polish-4a: form now submits into a Script in the scripts
            store, navigates to /scripts/:id (ScriptStudio). */}
        <Route path="/scripts/new" element={<CreateScriptPage />} />
        {/* polish-4a: dedicated Script Studio surface. Loads a
            Script from localStorage; agent runs MODE 3 against a
            synthetic-course wrapper around the script. */}
        <Route path="/scripts/:id" element={<ScriptStudio />} />
        {/* Track-B-Quiz: standalone KC builder. Brief form +
            result view both wrap in AgentProvider — KC Studio uses
            useAgent for sendBuildKc / kcBuilds / pendingMaterials.
            (Reminder for the AgentProvider-hoist refactor: these
            wrappers go away once provider lives at the root.) */}
        <Route path="/kcs/new" element={<AgentProvider><CreateKcPage /></AgentProvider>} />
        <Route path="/kcs/:id" element={<AgentProvider><KcStudio /></AgentProvider>} />
        <Route path="/player" element={<ScormPlayer />} />
        <Route path="/projects" element={<ProjectsLibrary />} />
        {/* Legacy routes */}
        <Route path="/course-builder" element={<Navigate to="/courses" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
