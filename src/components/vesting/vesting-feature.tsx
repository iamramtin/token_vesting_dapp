"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  VestingCreate,
  VestingAuthorityDashboard,
  VestingScheduleDashboard,
} from "./vesting-ui";
import { useVestingProgram } from "./vesting-data-access";

export function VestingFeature() {
  const { publicKey } = useWallet();
  const { getVestingAuthorityAccounts, getVestingScheduleAccounts } =
    useVestingProgram();
  const [activeTab, setActiveTab] = useState<
    "create" | "authority" | "schedule"
  >("create");

  // Loading states
  const isAuthorityLoading = getVestingAuthorityAccounts.isLoading;
  const isBeneficiaryLoading = getVestingScheduleAccounts.isLoading;

  // Data states
  const authorityAccounts = getVestingAuthorityAccounts.data || [];
  const scheduleAccounts = getVestingScheduleAccounts.data || [];

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="alert alert-info mt-4">
          <div>
            <span>Connect your wallet to manage vesting accounts</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="tabs tabs-boxed mb-4">
        <a
          className={`tab ${activeTab === "create" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("create")}
        >
          Create Vesting
        </a>
        <a
          className={`tab ${activeTab === "authority" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("authority")}
        >
          Authority Dashboard{" "}
          {authorityAccounts.length > 0 && `(${authorityAccounts.length})`}
        </a>
        <a
          className={`tab ${activeTab === "schedule" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          Schedule Dashboard{" "}
          {scheduleAccounts.length > 0 && `(${scheduleAccounts.length})`}
        </a>
      </div>

      {activeTab === "create" && <VestingCreate />}

      {activeTab === "authority" && (
        <>
          {isAuthorityLoading ? (
            <div className="flex justify-center my-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : authorityAccounts.length > 0 ? (
            <VestingAuthorityDashboard accounts={authorityAccounts} />
          ) : (
            <div className="alert alert-info">
              <div>
                <span>
                  You do not have any authority vesting accounts. Create one
                  first.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "schedule" && (
        <>
          {isBeneficiaryLoading ? (
            <div className="flex justify-center my-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : scheduleAccounts.length > 0 ? (
            <VestingScheduleDashboard accounts={scheduleAccounts} />
          ) : (
            <div className="alert alert-info">
              <div>
                <span>You do not have any vesting schedule accounts.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
