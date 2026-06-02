"use client";

import dynamic from "next/dynamic";

const BossPOC = dynamic(() => import("@/components/BossPOC"), {
  ssr: false,
});

export default function BossPOCPage() {
  return <BossPOC />;
}
