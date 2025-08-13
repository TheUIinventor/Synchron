
// app/page.tsx (Server Component)
import dynamic from "next/dynamic";

const HomeClient = dynamic(() => import("./home-client"), { ssr: false });

export default function Home() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar placeholder for desktop (navigation is handled globally) */}
        <div className="hidden md:block w-64 flex-shrink-0"></div>
        {/* Main content */}
        <div className="flex-1">
          <HomeClient />
        </div>
      </div>
    </div>
  );
}