
import dynamicImport from "next/dynamic";

const HomeClient = dynamicImport(() => import("./home-client"), { ssr: false });

export const dynamic = 'force-dynamic';

export default function Home() {
  return <HomeClient />;
}