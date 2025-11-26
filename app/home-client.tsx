"use client";

import { Bagel_Fat_One } from "next/font/google";

const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-bagel-fat-one" });

export default function HomeClient() {
  return (
    <main className="p-8">
      <h1 className={`${bagel.className} text-5xl`}>Synchron</h1>
      <p className="text-muted-foreground mt-2">Your school day at a glance</p>
    </main>
  );

}
