"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CallsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?view=archive");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-bg">
      <p className="text-sm font-mono text-muted-foreground animate-pulse">
        Redirecting to archive…
      </p>
    </div>
  );
}
