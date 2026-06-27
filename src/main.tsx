import { createRoot } from "react-dom/client";

import "@fontsource/orbitron/600.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/share-tech-mono/400.css";

import "./watcher.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
