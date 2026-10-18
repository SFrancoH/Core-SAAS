import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/shell.css";

export const metadata: Metadata = {
  title: "Core SaaS",
  description: "Core SaaS: plataforma modular de empresas, usuarios y verticales"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
