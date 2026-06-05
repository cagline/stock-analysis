import { lazy } from "react";
import { useRoutes } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import UnauthorizedLayout from "./layouts/UnauthorizedLayout";

// Lazy load from feature index (per IMPLEMENTATION-GUIDE.md)
const ErrorPage = lazy(() =>
  import("./features/error").then((m) => ({ default: m.ErrorPage }))
);
const HomePage = lazy(() =>
  import("./features/home").then((m) => ({ default: m.HomePage }))
);
const HelpPage = lazy(() =>
  import("./features/help").then((m) => ({ default: m.HelpPage }))
);
const TodoPage = lazy(() =>
  import("./features/todo").then((m) => ({ default: m.TodoPage }))
);
const CounterPage = lazy(() =>
  import("./features/counter").then((m) => ({ default: m.CounterPage }))
);
const DashboardPage = lazy(() =>
  import("./features/dashboard").then((m) => ({ default: m.DashboardPage }))
);
const PortfolioPage = lazy(() =>
  import("./features/portfolio").then((m) => ({ default: m.PortfolioPage }))
);
const PriceHistoryPage = lazy(() =>
  import("./features/price-history").then((m) => ({ default: m.PriceHistoryPage }))
);
const PortfolioHistoryPage = lazy(() =>
  import("./features/portfolio-history").then((m) => ({ default: m.PortfolioHistoryPage }))
);

export default function AppRoutes() {
  return useRoutes([
    {
      element: <DashboardLayout />,
      children: [
        { path: "/", element: <DashboardPage /> },
        { path: "counter", element: <CounterPage /> },
        { path: "todo", element: <TodoPage /> },
        { path: "portfolio", element: <PortfolioPage /> },
        { path: "price-history", element: <PriceHistoryPage /> },
        { path: "portfolio-history", element: <PortfolioHistoryPage /> },
        { path: "error", element: <ErrorPage /> },
      ],
    },
    {
      element: <UnauthorizedLayout />,
      children: [
        { path: "home", element: <HomePage /> },
        { path: "about", element: <HelpPage /> },
      ],
    },
  ]);
}
