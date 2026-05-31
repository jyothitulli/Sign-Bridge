import { ReactNode } from "react";

export default function GlassCard({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-white/10
        bg-white/5
        backdrop-blur-xl
        p-6
        shadow-xl
      "
    >
      {children}
    </div>
  );
}