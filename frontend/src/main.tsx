import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { i18n } from "./shared/i18n";
import { PageState } from "./shared/ui";
import "./shared/theme/tokens.css";

void import("./db/sync").then(({ installSyncTriggers }) =>
  installSyncTriggers(),
);

const updateSW = registerSW({
  onNeedRefresh() {
    const prompt = document.createElement("button");
    prompt.type = "button";
    prompt.className =
      "fixed bottom-24 left-4 right-4 z-50 mx-auto min-h-touch max-w-md rounded-card bg-primary p-4 text-xl font-bold text-primary-text shadow-card";
    prompt.textContent = "A new version is ready — Reload";
    prompt.addEventListener("click", () => void updateSW(true));
    document.body.append(prompt);
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <React.Suspense
        fallback={
          <main className="mx-auto max-w-2xl p-6">
            <PageState title={i18n.t("health.loading")} tone="loading" />
          </main>
        }
      >
        <RouterProvider router={router} />
      </React.Suspense>
    </AppProviders>
  </React.StrictMode>,
);
