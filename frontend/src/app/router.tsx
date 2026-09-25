/* eslint-disable react-refresh/only-export-components -- lazy route components live with the router configuration. */
import { createElement, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { RequireRole } from "./layouts/RequireRole";
import { Navigate } from "react-router-dom";

const LandingPage = lazy(() =>
  import("../features/auth/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const PatientLayout = lazy(() =>
  import("./layouts/RoleLayouts").then((module) => ({
    default: module.PatientLayout,
  })),
);
const ProLayout = lazy(() =>
  import("./layouts/RoleLayouts").then((module) => ({
    default: module.ProLayout,
  })),
);
const RegisterPage = lazy(() =>
  import("../features/auth/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);
const AdminPortalPage = lazy(() =>
  import("../features/auth/AdminPortalPage").then((module) => ({
    default: module.AdminPortalPage,
  })),
);
const ProfessionalLoginPage = lazy(() =>
  import("../features/auth/ProfessionalLoginPage").then((module) => ({
    default: module.ProfessionalLoginPage,
  })),
);
const PatientLoginPage = lazy(() =>
  import("../features/auth/PatientLoginPage").then((module) => ({
    default: module.PatientLoginPage,
  })),
);
const PatientHomePage = lazy(() =>
  import("../features/patient/home/PatientHomePage").then((module) => ({
    default: module.PatientHomePage,
  })),
);
const CalmPage = lazy(() =>
  import("../features/patient/calm/CalmPage").then((module) => ({
    default: module.CalmPage,
  })),
);
const RoutinePage = lazy(() =>
  import("../features/patient/routine/RoutinePage").then((module) => ({
    default: module.RoutinePage,
  })),
);
const MedicinesPage = lazy(() =>
  import("../features/patient/medicines/MedicinesPage").then((module) => ({
    default: module.MedicinesPage,
  })),
);
const ProgressPage = lazy(() =>
  import("../features/patient/progress/ProgressPage").then((module) => ({
    default: module.ProgressPage,
  })),
);
const MemoriesPage = lazy(() =>
  import("../features/patient/memories/MemoriesPage").then((module) => ({
    default: module.MemoriesPage,
  })),
);
const MemoryDetailPage = lazy(() =>
  import("../features/patient/memories/MemoryDetailPage").then((module) => ({
    default: module.MemoryDetailPage,
  })),
);
const MemoryQuizPage = lazy(() =>
  import("../features/patient/memories/quiz/MemoryQuizPage").then((module) => ({
    default: module.MemoryQuizPage,
  })),
);
const PeoplePage = lazy(() =>
  import("../features/patient/people/PeoplePage").then((module) => ({
    default: module.PeoplePage,
  })),
);
const PracticePage = lazy(() =>
  import("../features/caregiver/PracticePage").then((module) => ({
    default: module.PracticePage,
  })),
);
const CaregiverPortal = lazy(() =>
  import("../features/caregiver/CaregiverPortal").then((module) => ({
    default: module.CaregiverPortal,
  })),
);
const GamesPage = lazy(() =>
  import("../features/patient/games/GamesPage").then((module) => ({
    default: module.GamesPage,
  })),
);
const GamePage = lazy(() =>
  import("../features/patient/games/GamePage").then((module) => ({
    default: module.GamePage,
  })),
);
const DoctorDashboard = lazy(() =>
  import("../features/doctor/DoctorDashboard").then((module) => ({
    default: module.DoctorDashboard,
  })),
);
const DoctorPatientPage = lazy(() =>
  import("../features/doctor/DoctorPatientPage").then((module) => ({
    default: module.DoctorPatientPage,
  })),
);
const WellnessPage = lazy(() =>
  import("../features/patient/sleep/WellnessPage").then((module) => ({
    default: module.WellnessPage,
  })),
);
const developmentRoutes = import.meta.env.DEV
  ? [
      {
        path: "/design-system",
        element: createElement(
          lazy(() => {
            const modulePath = [
              "/src",
              "shared/theme",
              "DesignSystemPage.tsx",
            ].join("/");
            return import(/* @vite-ignore */ modulePath).then((module) => ({
              default: module.DesignSystemPage,
            }));
          }),
        ),
      },
    ]
  : [];
const SettingsPage = lazy(() =>
  import("../features/patient/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

export const router = createBrowserRouter([
  ...developmentRoutes,
  { path: "/register", element: <RegisterPage /> },
  { path: "/login/user", element: <ProfessionalLoginPage role="patient" /> },
  {
    path: "/login/patient",
    element: <PatientLoginPage />,
  },
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    element: (
      <RequireRole allowed={["patient"]}>
        <PatientLayout />
      </RequireRole>
    ),
    children: [
      {
        path: "/patient",
        element: <PatientHomePage />,
      },
      { path: "/patient/routine", element: <RoutinePage /> },
      { path: "/patient/medicines", element: <MedicinesPage /> },
      { path: "/patient/progress", element: <ProgressPage /> },
      { path: "/patient/memories", element: <MemoriesPage /> },
      { path: "/patient/memories/quiz", element: <MemoryQuizPage /> },
      { path: "/patient/memories/:memoryId", element: <MemoryDetailPage /> },
      { path: "/patient/people", element: <PeoplePage /> },
      { path: "/patient/games", element: <GamesPage /> },
      { path: "/patient/games/:gameKey", element: <GamePage /> },
      { path: "/patient/settings", element: <SettingsPage /> },
      { path: "/patient/sleep", element: <WellnessPage /> },
      { path: "/patient/calm", element: <CalmPage /> },
      { path: "/patient/calm-time", element: <CalmPage /> },
      {
        path: "/patient/:section",
        element: <Navigate to="/patient" replace />,
      },
    ],
  },
  {
    path: "/login/caregiver",
    element: <ProfessionalLoginPage role="caregiver" />,
  },
  { path: "/login/doctor", element: <ProfessionalLoginPage role="doctor" /> },
  { path: "/login/admin", element: <Navigate to="/portal/admin" replace /> },
  { path: "/portal/admin", element: <AdminPortalPage /> },
  {
    element: (
      <RequireRole allowed={["caregiver", "doctor"]}>
        <ProLayout />
      </RequireRole>
    ),
    children: [
      {
        path: "/caregiver/:patientId/practice/:gameKey?",
        element: (
          <RequireRole allowed={["caregiver"]}>
            <PracticePage />
          </RequireRole>
        ),
      },
      {
        path: "/caregiver/:patientId?/:tab?",
        element: (
          <RequireRole allowed={["caregiver"]}>
            <CaregiverPortal />
          </RequireRole>
        ),
      },
      {
        path: "/doctor",
        element: (
          <RequireRole allowed={["doctor"]}>
            <DoctorDashboard />
          </RequireRole>
        ),
      },
      {
        path: "/doctor/patients/:patientId/:tab?",
        element: (
          <RequireRole allowed={["doctor"]}>
            <DoctorPatientPage />
          </RequireRole>
        ),
      },
    ],
  },
  { path: "*", element: <LandingPage /> },
]);
