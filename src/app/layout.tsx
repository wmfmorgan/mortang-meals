import type { ReactNode } from "react";

export const metadata = {
  title: "Mortang Meals",
  description: "Local household meal planner",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
