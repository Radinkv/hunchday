import "./styles.css";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { machinesForDate, todayDate } from "../game/calendar";
import { App } from "./App";

/** The identifier of the element the application mounts into. */
const ROOT_ELEMENT_ID = "root";

inject();
injectSpeedInsights();

const root = document.getElementById(ROOT_ELEMENT_ID);
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App machines={machinesForDate(todayDate())} />
    </StrictMode>,
  );
}
