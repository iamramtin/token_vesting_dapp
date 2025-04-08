"use client";

import { Suspense } from "react";
import { VestingFeature } from "../../components/vesting/vesting-feature";

export default function VestingPage() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="w-full">
        <h1 className="text-4xl font-bold mb-6">Token Vesting Dashboard</h1>
        <p className="text-xl mb-8">
          Create and manage token vesting plans
        </p>
        <Suspense
          fallback={
            <div className="flex justify-center py-24">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          }
        >
          <VestingFeature />
        </Suspense>
      </div>
    </main>
  );
}
