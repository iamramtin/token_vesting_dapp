"use client";

import { useState, useEffect, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import {
  useEmployeeVestingAccount,
  useEmployerVestingAccount,
  useVestingProgram,
} from "./vesting-data-access";

export function VestingCreate() {
  const { createEmployerVestingAccount } = useVestingProgram();
  const { publicKey } = useWallet();
  const [companyName, setCompanyName] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [isValidMint, setIsValidMint] = useState(true);

  // Validate token mint format
  useEffect(() => {
    if (!tokenMint) {
      setIsValidMint(true);
      return;
    }

    try {
      new PublicKey(tokenMint);
      setIsValidMint(true);
    } catch (error) {
      setIsValidMint(false);
    }
  }, [tokenMint]);

  const isFormValid =
    companyName.length > 0 && (tokenMint.length === 0 || isValidMint);

  const handleSubmit = () => {
    if (publicKey && isFormValid) {
      createEmployerVestingAccount.mutateAsync({
        companyName,
        tokenMint,
      });
    }
  };

  if (!publicKey) {
    return <p>Connect your wallet</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Company Name</span>
        </label>
        <input
          type="text"
          placeholder="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Token Mint Address</span>
        </label>
        <input
          type="text"
          placeholder="Token Mint Address"
          value={tokenMint}
          onChange={(e) => setTokenMint(e.target.value)}
          className={`input input-bordered w-full ${
            !isValidMint ? "input-error" : ""
          }`}
        />
        {!isValidMint && (
          <label className="label">
            <span className="label-text-alt text-error">
              Invalid token mint address
            </span>
          </label>
        )}
      </div>

      <button
        className="btn btn-primary mt-4"
        onClick={handleSubmit}
        disabled={createEmployerVestingAccount.isPending || !isFormValid}
      >
        Create New Vesting Account
        {createEmployerVestingAccount.isPending && (
          <span className="loading loading-spinner loading-sm ml-2"></span>
        )}
      </button>
    </div>
  );
}

function VestingCard({ account }: { account: PublicKey }) {
  const { accountQuery } = useEmployerVestingAccount(account);
  const { createEmployeeVestingAccount } = useVestingProgram();

  const now = Math.floor(Date.now() / 1000);
  const [employee, setEmployee] = useState("");
  const [startTime, setStartTime] = useState(now);
  const [endTime, setEndTime] = useState(now + 60 * 60 * 24 * 365); // 1 year later
  const [cliffTime, setCliffTime] = useState(now + 60 * 60 * 24 * 30); // 1 month later
  const [totalAmount, setTotalAmount] = useState(0);
  const [isValidEmployee, setIsValidEmployee] = useState(true);

  // Validate employee address
  useEffect(() => {
    if (!employee) {
      setIsValidEmployee(true);
      return;
    }

    try {
      new PublicKey(employee);
      setIsValidEmployee(true);
    } catch (error) {
      setIsValidEmployee(false);
    }
  }, [employee]);

  const companyName = useMemo(
    () => accountQuery.data?.companyName ?? "",
    [accountQuery.data?.companyName]
  );

  const isFormValid =
    isValidEmployee &&
    employee &&
    startTime &&
    endTime &&
    cliffTime &&
    totalAmount &&
    endTime > startTime &&
    cliffTime >= startTime;

  const handleCreateEmployeeVesting = () => {
    if (!isFormValid) return;

    createEmployeeVestingAccount.mutateAsync({
      employee,
      employerVesting: account.toString(),
      startTime,
      endTime,
      cliffTime,
      totalAmount,
    });
  };

  return accountQuery.isLoading ? (
    <span className="loading loading-spinner loading-lg"></span>
  ) : (
    <div className="card card-bordered border-base-300 border-2 bg-base-100">
      <div className="card-body">
        <h2 className="card-title text-xl">{companyName}</h2>

        <div className="divider">Employee Vesting</div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Employee Address</span>
          </label>
          <input
            type="text"
            placeholder="Employee Address"
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className={`input input-bordered w-full ${
              !isValidEmployee ? "input-error" : ""
            }`}
          />
          {!isValidEmployee && (
            <label className="label">
              <span className="label-text-alt text-error">Invalid address</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Start Time (Unix)</span>
            </label>
            <input
              type="number"
              placeholder="Start Time"
              value={startTime}
              onChange={(e) => setStartTime(parseInt(e.target.value))}
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">End Time (Unix)</span>
            </label>
            <input
              type="number"
              placeholder="End Time"
              value={endTime}
              onChange={(e) => setEndTime(parseInt(e.target.value))}
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Cliff Time (Unix)</span>
            </label>
            <input
              type="number"
              placeholder="Cliff Time"
              value={cliffTime}
              onChange={(e) => setCliffTime(parseInt(e.target.value))}
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Total Amount</span>
            </label>
            <input
              type="number"
              placeholder="Total Allocation"
              value={totalAmount}
              onChange={(e) => setTotalAmount(parseInt(e.target.value))}
              className="input input-bordered w-full"
            />
          </div>
        </div>

        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary"
            onClick={handleCreateEmployeeVesting}
            disabled={createEmployeeVestingAccount.isPending || !isFormValid}
          >
            Create Employee Vesting
            {createEmployeeVestingAccount.isPending && (
              <span className="loading loading-spinner loading-sm ml-2"></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// New component for employer dashboard
export function EmployerVestingDashboard({ accounts }: { accounts: any[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Employer Vesting Accounts</h2>
      {accounts.length === 0 ? (
        <div className="alert alert-info">
          <span>No employer vesting accounts found.</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-1 gap-6">
          {accounts.map((account) => (
            <EmployerVestingDetail
              key={account.publicKey.toString()}
              accountKey={new PublicKey(account.publicKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployerVestingDetail({ accountKey }: { accountKey: PublicKey }) {
  const { employerVestingQuery, employeeVestingsQuery } =
    useEmployerVestingAccount(accountKey);

  const employerVesting = employerVestingQuery.data;
  const employeeVestings = employeeVestingsQuery.data || [];

  if (employerVestingQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-xl">{employerVesting?.companyName}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <p className="text-sm opacity-70">Vesting Account</p>
            <p className="font-mono text-xs">
              <ExplorerLink
                path={`account/${accountKey}`}
                label={ellipsify(accountKey.toString())}
              />
            </p>
          </div>

          <div>
            <p className="text-sm opacity-70">Token Mint</p>
            <p className="font-mono text-xs">
              <ExplorerLink
                path={`account/${employerVesting?.tokenMint}`}
                label={ellipsify(employerVesting?.tokenMint?.toString() || "")}
              />
            </p>
          </div>

          <div>
            <p className="text-sm opacity-70">Treasury Account</p>
            <p className="font-mono text-xs">
              <ExplorerLink
                path={`account/${employerVesting?.treasuryAccount}`}
                label={ellipsify(
                  employerVesting?.treasuryAccount?.toString() || ""
                )}
              />
            </p>
          </div>
        </div>

        <div className="divider">Employees</div>

        {employeeVestingsQuery.isLoading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : employeeVestings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Amount</th>
                  <th>Vested</th>
                  <th>Withdrawn</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employeeVestings.map((vestingAccount) => {
                  const now = Math.floor(Date.now() / 1000);
                  const totalTime =
                    Number(vestingAccount.endTime) -
                    Number(vestingAccount.startTime);
                  const elapsedTime = Math.min(
                    now - Number(vestingAccount.startTime),
                    totalTime
                  );
                  const vestedPercentage =
                    totalTime > 0 ? (elapsedTime / totalTime) * 100 : 0;
                  const withdrawnPercentage =
                    (Number(vestingAccount.totalWithdrawn) /
                      Number(vestingAccount.totalAmount)) *
                    100;

                  let status = "Upcoming";
                  if (now >= Number(vestingAccount.endTime)) {
                    status = "Completed";
                  } else if (now >= Number(vestingAccount.cliffTime)) {
                    status = "Active";
                  }

                  return (
                    <tr key={vestingAccount.publicKey.toString()}>
                      <td className="font-mono text-xs">
                        <ExplorerLink
                          path={`account/${vestingAccount.employee}`}
                          label={ellipsify(vestingAccount.employee.toString())}
                        />
                      </td>
                      <td>{vestingAccount.totalAmount.toString()}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <progress
                            className="progress progress-primary w-20"
                            value={vestedPercentage}
                            max="100"
                          ></progress>
                          <span className="text-xs">
                            {Math.floor(vestedPercentage)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <progress
                            className="progress progress-success w-20"
                            value={withdrawnPercentage}
                            max="100"
                          ></progress>
                          <span className="text-xs">
                            {Math.floor(withdrawnPercentage)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            status === "Active"
                              ? "badge-primary"
                              : status === "Completed"
                              ? "badge-success"
                              : "badge-ghost"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="alert alert-info">
            <span>No employees added to this vesting account yet.</span>
          </div>
        )}

        <div className="card-actions justify-end mt-4">
          <VestingCard account={accountKey} />
        </div>
      </div>
    </div>
  );
}

// New component for employee dashboard
export function EmployeeVestingDashboard({ accounts }: { accounts: any[] }) {
  const { programId, claimTokens } = useVestingProgram();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Employee Vesting Accounts</h2>
      {accounts.length === 0 ? (
        <div className="alert alert-info">
          <span>No employee vesting accounts found.</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-1 gap-6">
          {accounts.map((account) => (
            <EmployeeVestingDetail
              key={account.publicKey.toString()}
              accountKey={new PublicKey(account.publicKey)}
              claimTokens={claimTokens}
              programId={programId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeVestingDetail({
  accountKey,
  claimTokens,
  programId,
}: {
  accountKey: PublicKey;
  claimTokens: any;
  programId: PublicKey;
}) {
  const { employeeVestingQuery } = useEmployeeVestingAccount(accountKey);
  const { employerVestingQuery } = useEmployerVestingAccount(
    employeeVestingQuery.data?.employerVesting
  );

  const employeeVesting = employeeVestingQuery.data;
  const employerVesting = employerVestingQuery.data;

  const now = Math.floor(Date.now() / 1000);

  if (employeeVestingQuery.isLoading || employerVestingQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }

  if (!employeeVesting || !employerVesting) {
    return (
      <div className="alert alert-error">
        <span>Failed to load vesting details.</span>
      </div>
    );
  }

  // Calculate vesting details
  const totalVestingTime =
    Number(employeeVesting.endTime) - Number(employeeVesting.startTime);
  const timeSinceStart = Math.max(0, now - Number(employeeVesting.startTime));
  const timeElapsed = Math.min(timeSinceStart, totalVestingTime);

  // Calculate vested amount
  let vestedAmount = 0;
  if (now >= Number(employeeVesting.endTime)) {
    vestedAmount = Number(employeeVesting.totalAmount);
  } else if (now > Number(employeeVesting.startTime)) {
    vestedAmount = Math.floor(
      (Number(employeeVesting.totalAmount) * timeElapsed) / totalVestingTime
    );
  }

  const withdrawnAmount = Number(employeeVesting.totalWithdrawn);
  const claimableAmount = Math.max(0, vestedAmount - withdrawnAmount);

  const vestedPercentage =
    (vestedAmount / Number(employeeVesting.totalAmount)) * 100;
  const withdrawnPercentage =
    (withdrawnAmount / Number(employeeVesting.totalAmount)) * 100;

  // Determine if user can claim
  const canClaim =
    claimableAmount > 0 && now >= Number(employeeVesting.cliffTime);

  // Calculate vesting schedule for the chart
  const daysTotal = Math.floor(totalVestingTime / (60 * 60 * 24));
  const daysSinceStart = Math.floor(timeSinceStart / (60 * 60 * 24));

  // Format dates for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleClaim = () => {
    if (!employerVesting?.companyName) return;

    claimTokens.mutateAsync({
      companyName: employerVesting.companyName,
    });
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">{employerVesting.companyName} Vesting</h2>

        <div className="stats shadow mt-4">
          <div className="stat">
            <div className="stat-title">Total Allocation</div>
            <div className="stat-value">
              {employeeVesting.totalAmount.toString()}
            </div>
          </div>

          <div className="stat">
            <div className="stat-title">Vested Tokens</div>
            <div className="stat-value">{vestedAmount}</div>
            <div className="stat-desc">
              {Math.floor(vestedPercentage)}% of total
            </div>
          </div>

          <div className="stat">
            <div className="stat-title">Claimed Tokens</div>
            <div className="stat-value">{withdrawnAmount}</div>
            <div className="stat-desc">
              {Math.floor(withdrawnPercentage)}% of total
            </div>
          </div>

          <div className="stat">
            <div className="stat-title">Available to Claim</div>
            <div className="stat-value">{claimableAmount}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-sm opacity-70">Start Date</p>
            <p>{formatDate(Number(employeeVesting.startTime))}</p>
          </div>

          <div>
            <p className="text-sm opacity-70">End Date</p>
            <p>{formatDate(Number(employeeVesting.endTime))}</p>
          </div>

          <div>
            <p className="text-sm opacity-70">Cliff Date</p>
            <p>{formatDate(Number(employeeVesting.cliffTime))}</p>
          </div>

          <div>
            <p className="text-sm opacity-70">Vesting Status</p>
            <p>
              {now < Number(employeeVesting.startTime) ? (
                <span className="badge badge-ghost">Not Started</span>
              ) : now < Number(employeeVesting.cliffTime) ? (
                <span className="badge badge-warning">Before Cliff</span>
              ) : now < Number(employeeVesting.endTime) ? (
                <span className="badge badge-primary">Active</span>
              ) : (
                <span className="badge badge-success">Completed</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold mb-2">Vesting Progress</p>
          <div className="w-full bg-base-200 rounded-full h-4">
            <div
              className="bg-primary rounded-full h-4"
              style={{ width: `${vestedPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>{formatDate(Number(employeeVesting.startTime))}</span>
            <span>{formatDate(Number(employeeVesting.endTime))}</span>
          </div>
        </div>

        <div className="card-actions justify-end mt-6">
          <button
            className="btn btn-primary"
            disabled={!canClaim || claimTokens.isPending}
            onClick={handleClaim}
          >
            {claimTokens.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Claiming...
              </>
            ) : (
              `Claim ${claimableAmount} Tokens`
            )}
          </button>
        </div>

        {!canClaim && now < Number(employeeVesting.cliffTime) && (
          <div className="alert alert-warning mt-4">
            <span>
              Tokens will be available for claiming after the cliff date:{" "}
              {formatDate(Number(employeeVesting.cliffTime))}
            </span>
          </div>
        )}

        {!canClaim &&
          vestedAmount === withdrawnAmount &&
          now >= Number(employeeVesting.cliffTime) && (
            <div className="alert alert-success mt-4">
              <span>You have claimed all currently available tokens.</span>
            </div>
          )}
      </div>
    </div>
  );
}
