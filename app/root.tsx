import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";

import "./tailwind.css";
import OfflineIndicator from "./components/OfflineIndicator";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "icon", href: "/favicon.ico" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <OfflineIndicator />
        <nav className="bg-white shadow p-4">
          <div className="container mx-auto flex items-center justify-between">
            <NavLink to="/" className="text-2xl font-bold black">
              ZSD
            </NavLink>
            <div className="space-x-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive ? "text-indigo-600" : "text-gray-600"
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/logs"
                className={({ isActive }) =>
                  isActive ? "text-indigo-600" : "text-gray-600"
                }
              >
                Logs
              </NavLink>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
