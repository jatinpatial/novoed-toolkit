import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import InfographicStudio from "./pages/InfographicStudio";
import CourseStudio from "./pages/CourseStudio";
import CreateCoursePage from "./pages/CreateCoursePage";
import CreateScriptPage from "./pages/CreateScriptPage";
import ScriptStudio from "./pages/ScriptStudio";
import ScormPlayer from "./pages/ScormPlayer";
import ProjectsLibrary from "./pages/ProjectsLibrary";
import { BrandBodyAttribute } from "./shell/TopBar";
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
        <Route path="/infographics" element={<InfographicStudio />} />
        <Route path="/courses" element={<CourseStudio />} />
        {/* C0: structured course-intake form. Wired from
            HeroComposer's "Detailed brief →" button. Mounted before
            the /courses route so /courses/new resolves before the
            /courses param-only route fallthrough. */}
        <Route path="/courses/new" element={<CreateCoursePage />} />
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
        <Route path="/player" element={<ScormPlayer />} />
        <Route path="/projects" element={<ProjectsLibrary />} />
        {/* Legacy routes */}
        <Route path="/course-builder" element={<Navigate to="/courses" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
