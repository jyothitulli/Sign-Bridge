export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="absolute right-20 top-40 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="absolute bottom-20 left-1/2 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
    </div>
  );
}