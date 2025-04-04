"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  VestingCreate,
  EmployerVestingDashboard,
  EmployeeVestingDashboard,
} from "./vesting-ui";
import { useVestingProgram } from "./vesting-data-access";

export function VestingFeature() {
  const { publicKey } = useWallet();
  const { getEmployerVestingAccounts, getEmployeeVestingAccounts } =
    useVestingProgram();
  const [activeTab, setActiveTab] = useState<
    "create" | "employer" | "employee"
  >("create");

  // Loading states
  const isEmployerLoading = getEmployerVestingAccounts.isLoading;
  const isEmployeeLoading = getEmployeeVestingAccounts.isLoading;

  // Data states
  const employerAccounts = getEmployerVestingAccounts.data || [];
  const employeeAccounts = getEmployeeVestingAccounts.data || [];

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
          className={`tab ${activeTab === "employer" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("employer")}
        >
          Employer Dashboard{" "}
          {employerAccounts.length > 0 && `(${employerAccounts.length})`}
        </a>
        <a
          className={`tab ${activeTab === "employee" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("employee")}
        >
          Employee Dashboard{" "}
          {employeeAccounts.length > 0 && `(${employeeAccounts.length})`}
        </a>
      </div>

      {activeTab === "create" && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="text-2xl font-bold mb-4">
              Create New Vesting Account
            </h2>
            <VestingCreate />
          </div>
        </div>
      )}

      {activeTab === "employer" && (
        <>
          {isEmployerLoading ? (
            <div className="flex justify-center my-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : employerAccounts.length > 0 ? (
            <EmployerVestingDashboard accounts={employerAccounts} />
          ) : (
            <div className="alert alert-info">
              <div>
                <span>
                  You do not have any employer vesting accounts. Create one
                  first.
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "employee" && (
        <>
          {isEmployeeLoading ? (
            <div className="flex justify-center my-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : employeeAccounts.length > 0 ? (
            <EmployeeVestingDashboard accounts={employeeAccounts} />
          ) : (
            <div className="alert alert-info">
              <div>
                <span>You do not have any employee vesting accounts.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
