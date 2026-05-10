import { createBrowserRouter } from "react-router";
import HomePage from "./pages/HomePage";
import RecordPage from "./pages/RecordPage";
import TimelinePage from "./pages/TimelinePage";
import FamilyPage from "./pages/FamilyPage";
import MyPage from "./pages/MyPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
  },
  {
    path: "/record",
    Component: RecordPage,
  },
  {
    path: "/timeline",
    Component: TimelinePage,
  },
  {
    path: "/family",
    Component: FamilyPage,
  },
  {
    path: "/my",
    Component: MyPage,
  },
]);
