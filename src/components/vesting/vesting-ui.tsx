"use client";

import { useState, useEffect, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import {
  useVestingScheduleAccount,
  useVestingAuthorityAccount,
  useVestingProgram,
} from "./vesting-data-access";

export function VestingCreate() {
  const { createVestingAuthorityAccount } = useVestingProgram();
  const { publicKey } = useWallet();
  const [vestingId, setVestingId] = useState("");
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
    vestingId.length > 0 && (tokenMint.length === 0 || isValidMint);

  const handleSubmit = () => {
    if (publicKey && isFormValid) {
      createVestingAuthorityAccount.mutateAsync({
        vestingId,
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
          <span className="label-text">Vesting ID</span>
        </label>
        <input
          type="text"
          placeholder="Vesting ID"
          value={vestingId}
          onChange={(e) => setVestingId(e.target.value)}
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
        disabled={createVestingAuthorityAccount.isPending || !isFormValid}
      >
        Create New Vesting Account
        {createVestingAuthorityAccount.isPending && (
          <span className="loading loading-spinner loading-sm ml-2"></span>
        )}
      </button>
    </div>
  );
}

function VestingCard({ account }: { account: PublicKey }) {
  const { accountQuery } = useVestingAuthorityAccount(account);
  const { createVestingScheduleAccount } = useVestingProgram();

  const now = Math.floor(Date.now() / 1000);
  const [beneficiary, setBeneficiary] = useState("");
  const [startTime, setStartTime] = useState(now);
  const [endTime, setEndTime] = useState(now + 60 * 3); // 3 minutes later
  const [cliffTime, setCliffTime] = useState(now + 60); // 1 minute later
  const [totalAmount, setTotalAmount] = useState(0);
  const [isValidSchedule, setIsValidSchedule] = useState(true);

  // Validate beneficiary address
  useEffect(() => {
    if (!beneficiary) {
      setIsValidSchedule(true);
      return;
    }

    try {
      new PublicKey(beneficiary);
      setIsValidSchedule(true);
    } catch (error) {
      setIsValidSchedule(false);
    }
  }, [beneficiary]);

  const vestingId = useMemo(
    () => accountQuery.data?.vestingId ?? "",
    [accountQuery.data?.vestingId]
  );

  const isFormValid =
    isValidSchedule &&
    beneficiary &&
    startTime &&
    endTime &&
    cliffTime &&
    totalAmount &&
    endTime > startTime &&
    cliffTime >= startTime;

  const handleCreateVestingSchedule = () => {
    if (!isFormValid) return;

    createVestingScheduleAccount.mutateAsync({
      beneficiary,
      vestingAuthority: account.toString(),
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
        <h2 className="card-title text-xl">{vestingId}</h2>

        <div className="divider">Vesting Schedule</div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Beneficiary Address</span>
          </label>
          <input
            type="text"
            placeholder="Beneficiary Address"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            className={`input input-bordered w-full ${
              !isValidSchedule ? "input-error" : ""
            }`}
          />
          {!isValidSchedule && (
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
            onClick={handleCreateVestingSchedule}
            disabled={createVestingScheduleAccount.isPending || !isFormValid}
          >
            Create Vesting Schedule
            {createVestingScheduleAccount.isPending && (
              <span className="loading loading-spinner loading-sm ml-2"></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// New component for authority dashboard
export function VestingAuthorityDashboard({ accounts }: { accounts: any[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Vesting Authority Accounts</h2>
      {accounts.length === 0 ? (
        <div className="alert alert-info">
          <span>No vesting authority accounts found.</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-1 gap-6">
          {accounts.map((account) => (
            <VestingAuthorityDetail
              key={account.publicKey.toString()}
              accountKey={new PublicKey(account.publicKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VestingAuthorityDetail({ accountKey }: { accountKey: PublicKey }) {
  const { vestingAuthorityQuery, vestingSchedulesQuery } =
    useVestingAuthorityAccount(accountKey);

  const vestingAuthority = vestingAuthorityQuery.data;
  const vestingSchedules = vestingSchedulesQuery.data || [];

  if (vestingAuthorityQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-xl">{vestingAuthority?.vestingId}</h2>

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
                path={`account/${vestingAuthority?.tokenMint}`}
                label={ellipsify(vestingAuthority?.tokenMint?.toString() || "")}
              />
            </p>
          </div>

          <div>
            <p className="text-sm opacity-70">Treasury Account</p>
            <p className="font-mono text-xs">
              <ExplorerLink
                path={`account/${vestingAuthority?.treasuryAccount}`}
                label={ellipsify(
                  vestingAuthority?.treasuryAccount?.toString() || ""
                )}
              />
            </p>
          </div>
        </div>

        <div className="divider">Beneficiaries</div>

        {vestingSchedulesQuery.isLoading ? (
          <span className="loading loading-spinner loading-md"></span>
        ) : vestingSchedules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Beneficiary</th>
                  <th>Amount</th>
                  <th>Vested</th>
                  <th>Withdrawn</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vestingSchedules.map((vestingAccount) => {
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
                          path={`account/${vestingAccount.beneficiary}`}
                          label={ellipsify(
                            vestingAccount.beneficiary.toString()
                          )}
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
            <span>No beneficiaries added to this vesting account yet.</span>
          </div>
        )}

        <div className="card-actions justify-end mt-4">
          <VestingCard account={accountKey} />
        </div>
      </div>
    </div>
  );
}

// New component for beneficiary dashboard
export function VestingScheduleDashboard({ accounts }: { accounts: any[] }) {
  const { claimTokens } = useVestingProgram();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Vesting Schedules</h2>
      {accounts.length === 0 ? (
        <div className="alert alert-info">
          <span>No vesting schedules found.</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-1 gap-6">
          {accounts.map((account) => (
            <VestingScheduleDetail
              key={account.publicKey.toString()}
              accountKey={new PublicKey(account.publicKey)}
              claimTokens={claimTokens}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VestingScheduleDetail({
  accountKey,
  claimTokens,
}: {
  accountKey: PublicKey;
  claimTokens: any;
}) {
  const { connection } = useConnection();
  const { vestingScheduleQuery } = useVestingScheduleAccount(accountKey);
  const { vestingAuthorityQuery } = useVestingAuthorityAccount(
    vestingScheduleQuery.data?.vestingAuthority
  );

  const vestingSchedule = vestingScheduleQuery.data;
  const vestingAuthority = vestingAuthorityQuery.data;

  const now = Math.floor(Date.now() / 1000);
  const [blockchainTime, setBlockchainTime] = useState(
    Math.floor(Date.now() / 1000)
  );

  useEffect(() => {
    async function fetchBlockchainTime() {
      try {
        const slot = await connection.getSlot();
        const timestamp = await connection.getBlockTime(slot);
        if (timestamp) setBlockchainTime(timestamp);
      } catch (err) {
        console.error("Error fetching blockchain time:", err);
      }
    }

    fetchBlockchainTime();
    // Refresh every minute
    const interval = setInterval(fetchBlockchainTime, 60000);
    return () => clearInterval(interval);
  }, [connection]);

  if (vestingScheduleQuery.isLoading || vestingAuthorityQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }

  if (!vestingSchedule || !vestingAuthority) {
    return (
      <div className="alert alert-error">
        <span>Failed to load vesting details.</span>
      </div>
    );
  }

  // Calculate vesting details
  const totalVestingTime =
    Number(vestingSchedule.endTime) - Number(vestingSchedule.startTime);
  const timeSinceStart = Math.max(
    0,
    blockchainTime - Number(vestingSchedule.startTime)
  );
  const timeElapsed = Math.min(timeSinceStart, totalVestingTime);

  // Calculate vested amount
  let vestedAmount = 0;
  if (now >= Number(vestingSchedule.endTime)) {
    vestedAmount = Number(vestingSchedule.totalAmount);
  } else if (now > Number(vestingSchedule.startTime)) {
    vestedAmount = Math.floor(
      (Number(vestingSchedule.totalAmount) * timeElapsed) / totalVestingTime
    );
  }

  const withdrawnAmount = Number(vestingSchedule.totalWithdrawn);
  const claimableAmount = Math.max(0, vestedAmount - withdrawnAmount);

  const vestedPercentage =
    (vestedAmount / Number(vestingSchedule.totalAmount)) * 100;
  const withdrawnPercentage =
    (withdrawnAmount / Number(vestingSchedule.totalAmount)) * 100;

  // Determine if user can claim
  const canClaim =
    claimableAmount > 0 && blockchainTime >= Number(vestingSchedule.cliffTime);

  // Format dates for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleClaim = () => {
    if (!vestingAuthority?.vestingId) return;

    claimTokens.mutateAsync({
      vestingId: vestingAuthority.vestingId,
    });
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">{vestingAuthority.vestingId}</h2>

        <div className="stats shadow mt-4">
          <div className="stat">
            <div className="stat-title">Total Allocation</div>
            <div className="stat-value">
              {vestingSchedule.totalAmount.toString()}
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
            <p>
              {new Date(
                Number(vestingSchedule.startTime) * 1000
              ).toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-sm opacity-70">End Date</p>
            <p>
              {new Date(
                Number(vestingSchedule.endTime) * 1000
              ).toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-sm opacity-70">Cliff Date</p>
            <p>
              {new Date(
                Number(vestingSchedule.cliffTime) * 1000
              ).toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-sm opacity-70">Vesting Status</p>
            <p>
              {now < Number(vestingSchedule.startTime) ? (
                <span className="badge badge-ghost">Not Started</span>
              ) : now < Number(vestingSchedule.cliffTime) ? (
                <span className="badge badge-warning">Before Cliff</span>
              ) : now < Number(vestingSchedule.endTime) ? (
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
            <span>
              {new Date(
                Number(vestingSchedule.startTime) * 1000
              ).toLocaleString()}
            </span>
            <span>
              {new Date(
                Number(vestingSchedule.endTime) * 1000
              ).toLocaleString()}
            </span>
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

        {!canClaim && now < Number(vestingSchedule.cliffTime) && (
          <div className="alert alert-warning mt-4">
            <div>
              <span>
                Tokens will be available for claiming after the cliff date:{" "}
                {formatDate(Number(vestingSchedule.cliffTime))}
              </span>
              <p className="text-xs mt-1">
                Current time: {formatDate(now)} (Browser)
                <br />
                Time until cliff:{" "}
                {Math.floor(
                  (Number(vestingSchedule.cliffTime) - now) / 60
                )}{" "}
                minutes
              </p>
            </div>
          </div>
        )}

        {!canClaim &&
          vestedAmount === withdrawnAmount &&
          now >= Number(vestingSchedule.cliffTime) && (
            <div className="alert alert-success mt-4">
              <span>You have claimed all currently available tokens.</span>
            </div>
          )}
      </div>
    </div>
  );
}
