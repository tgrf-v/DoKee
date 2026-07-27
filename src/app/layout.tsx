import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "DoKee - Self-Productivity & Anti-Distraction System",
  description: "Stay focused, execute tasks on schedule, and reclaim your time with DoKee.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-slate-900 min-h-screen">
        <AuthProvider>
          <div className="flex flex-col md:flex-row min-h-screen bg-white">
            <Sidebar />
            <div className="flex-1 overflow-x-hidden p-4 md:p-4">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
