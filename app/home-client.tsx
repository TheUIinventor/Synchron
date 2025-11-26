"use client";

import { Bagel_Fat_One } from "next/font/google";
import { formatDate, getCurrentDay } from "../utils/time-utils";

const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-bagel-fat-one" });

export default function HomeClient() {
  const day = getCurrentDay();
  const pretty = formatDate();

  return (
    <main className="p-8 mt-12">
      <header className="mb-6">
        <h2 className={`${bagel.className} text-6xl font-semibold`}>{day}</h2>
        <p className={`${bagel.className} text-sm text-muted-foreground mt-1`}>{pretty}</p>
      </header>

      <h1 className="sr-only">Synchron</h1>
      <p className="text-muted-foreground">Your school day at a glance</p>
    </main>
  )

}
