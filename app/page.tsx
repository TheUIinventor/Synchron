

// app/page.tsx (Server Component)
import dynamic from "next/dynamic";

const HomeClient = dynamic(() => import("./home-client"), { ssr: false });

export default function Home() {
  return <HomeClient />;
}