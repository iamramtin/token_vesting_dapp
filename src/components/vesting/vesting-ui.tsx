"use client";

import { useState, useEffect, useMemo } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ellipsify } from "../ui/ui-layout";
import { ExplorerLink } from "../cluster/cluster-ui";
import {
  useVestingScheduleAccount,
  useVestingAuthorityAccount,
  useVestingProgram,
  useTreasuryBalance,
  useTotalAllocatedTokens,
} from "./vesting-data-access";
import toast from "react-hot-toast";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

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
    return (
      <div className="alert alert-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Please connect your wallet to continue</span>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-2xl">Create New Vesting Authority</h2>
        <p className="opacity-70">
          Create a vesting authority to manage token allocations for
          beneficiaries
        </p>

        <div className="divider"></div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Vesting ID</span>
            <span className="label-text-alt opacity-60">
              Unique identifier for this vesting authority
            </span>
          </label>
          <input
            type="text"
            placeholder="e.g., MyCompany-Vesting-2025"
            value={vestingId}
            onChange={(e) => setVestingId(e.target.value)}
            className="input input-bordered w-full"
          />
        </div>

        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Token Mint Address</span>
            <span className="label-text-alt opacity-60">
              The SPL token to be distributed
            </span>
          </label>
          <input
            type="text"
            placeholder="e.g., 4cM4PPEHs9nCZQMVDZxiRgNbGtjrmaNrT87qEb4BQBBa"
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

        <div className="card-actions justify-end mt-6">
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={createVestingAuthorityAccount.isPending || !isFormValid}
          >
            {createVestingAuthorityAccount.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Vesting Authority"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function VestingCard({ account }: { account: PublicKey }) {
  const { accountQuery } = useVestingAuthorityAccount(account);
  const { createVestingScheduleAccount } = useVestingProgram();

  const now = Math.floor(Date.now() / 1000);
  const [beneficiary, setBeneficiary] = useState("");
  const [startTime, setStartTime] = useState(now);
  const [endTime, setEndTime] = useState(now + 60 * 60); // 1 hour later
  const [cliffTime, setCliffTime] = useState(now + 60 * 5); // 5 minutes later - increased for better user experience
  const [totalAmount, setTotalAmount] = useState(0);
  const [isValidSchedule, setIsValidSchedule] = useState(true);

  // Convert Unix times to readable format for display
  const formatDate = (unixTime: number) => {
    return new Date(unixTime * 1000).toLocaleString();
  };

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
    totalAmount > 0 &&
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
    <div className="flex justify-center p-8">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  ) : (
    <div className="card card-bordered border-base-300 border-2 bg-base-100">
      <div className="card-body">
        <h2 className="card-title text-xl">
          Create Vesting Schedule for {vestingId}
        </h2>

        <div className="alert alert-info mt-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>
            Create a vesting schedule for a beneficiary. The tokens will vest
            linearly between the start and end time, with a cliff period before
            any tokens can be claimed.
          </span>
        </div>

        <div className="form-control mt-4">
          <label className="label">
            <span className="label-text">Beneficiary Address</span>
            <span className="label-text-alt opacity-60">
              Recipient of the vested tokens
            </span>
          </label>
          <input
            type="text"
            placeholder="Enter the beneficiary's wallet address"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            className={`input input-bordered w-full ${
              !isValidSchedule ? "input-error" : ""
            }`}
          />
          {!isValidSchedule && (
            <label className="label">
              <span className="label-text-alt text-error">
                Invalid wallet address
              </span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Start Date</span>
            </label>
            <input
              type="datetime-local"
              value={new Date(startTime * 1000).toISOString().slice(0, 16)}
              onChange={(e) =>
                setStartTime(
                  Math.floor(new Date(e.target.value).getTime() / 1000)
                )
              }
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt">{formatDate(startTime)}</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">End Date</span>
            </label>
            <input
              type="datetime-local"
              value={new Date(endTime * 1000).toISOString().slice(0, 16)}
              onChange={(e) =>
                setEndTime(
                  Math.floor(new Date(e.target.value).getTime() / 1000)
                )
              }
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt">{formatDate(endTime)}</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Cliff Date</span>
              <span className="label-text-alt">When tokens first unlock</span>
            </label>
            <input
              type="datetime-local"
              value={new Date(cliffTime * 1000).toISOString().slice(0, 16)}
              onChange={(e) =>
                setCliffTime(
                  Math.floor(new Date(e.target.value).getTime() / 1000)
                )
              }
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt">{formatDate(cliffTime)}</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Total Amount</span>
              <span className="label-text-alt">Tokens to vest</span>
            </label>
            <input
              type="number"
              placeholder="Enter token amount"
              value={totalAmount || ""}
              onChange={(e) => setTotalAmount(parseInt(e.target.value) || 0)}
              className="input input-bordered w-full"
              min="1"
            />
          </div>
        </div>

        {!isFormValid && (
          <div className="alert alert-warning mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <span className="font-bold">Please check your inputs:</span>
              <ul className="list-disc list-inside text-sm mt-1">
                {!beneficiary && <li>Beneficiary address is required</li>}
                {!isValidSchedule && (
                  <li>Beneficiary address must be a valid Solana address</li>
                )}
                {endTime <= startTime && (
                  <li>End time must be after start time</li>
                )}
                {cliffTime < startTime && (
                  <li>Cliff time must be at least the start time</li>
                )}
                {totalAmount <= 0 && (
                  <li>Token amount must be greater than 0</li>
                )}
              </ul>
            </div>
          </div>
        )}

        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary"
            onClick={handleCreateVestingSchedule}
            disabled={createVestingScheduleAccount.isPending || !isFormValid}
          >
            {createVestingScheduleAccount.isPending ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating Schedule...
              </>
            ) : (
              "Create Vesting Schedule"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VestingAuthorityDashboard({ accounts }: { accounts: any[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Vesting Schedules</h2>
      {accounts.length === 0 ? (
        <div className="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <span className="font-bold">
              No vesting authority accounts found.
            </span>
            <p className="text-sm mt-1">
              Create a new vesting authority to get started.
            </p>
          </div>
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
  const { connection } = useConnection();
  const { programId, program } = useVestingProgram();
  const wallet = useWallet();
  const [fundingAmount, setFundingAmount] = useState<number | undefined>(
    undefined
  );
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const vestingAuthority = vestingAuthorityQuery.data;
  const vestingSchedules = vestingSchedulesQuery.data || [];

  const treasuryAccount = vestingAuthority?.treasuryAccount
    ? new PublicKey(vestingAuthority.treasuryAccount)
    : undefined;

  const tokenMint = vestingAuthority?.tokenMint
    ? new PublicKey(vestingAuthority.tokenMint)
    : undefined;

  const { data: treasuryBalance, isLoading: isLoadingBalance } =
    useTreasuryBalance(treasuryAccount, tokenMint);

  const totalAllocated = useTotalAllocatedTokens(vestingSchedules);
  const isSufficientlyFunded = (treasuryBalance ?? 0) >= totalAllocated;

  const totalWithdrawn = useMemo(() => {
    if (!vestingSchedules || vestingSchedules.length === 0) return 0;

    return vestingSchedules.reduce(
      (sum, schedule) => sum + Number(schedule.totalWithdrawn || 0),
      0
    );
  }, [vestingSchedules]);

  // Calculate remaining tokens needed
  const tokensNeeded = Math.max(0, totalAllocated - (treasuryBalance || 0));

  // Set default funding amount to the needed amount
  useEffect(() => {
    if (tokensNeeded > 0 && fundingAmount === undefined) {
      setFundingAmount(tokensNeeded);
    }
  }, [tokensNeeded, fundingAmount]);

  // Function to handle schedule revocation
  const handleRevokeSchedule = async () => {
    if (!selectedSchedule || !wallet.publicKey || isRevoking) return;

    setIsRevoking(true);
    try {
      const scheduleToRevoke = vestingSchedules.find(
        (schedule) => schedule.publicKey.toString() === selectedSchedule
      );

      if (!scheduleToRevoke) {
        throw new Error("Selected schedule not found");
      }

      // Verify the schedule isn't already revoked
      if (scheduleToRevoke.revokedAt) {
        throw new Error("Schedule is already revoked");
      }

      const tx = await program.methods
        .revokeSchedule()
        .accounts({
          authority: wallet.publicKey,
          vestingAuthority: accountKey,
          vestingSchedule: new PublicKey(selectedSchedule),
        })
        .rpc();

      toast.success("Schedule successfully revoked!");
      console.log("Revocation transaction:", tx);

      // Refresh the data
      vestingSchedulesQuery.refetch();

      // Clear selection
      setSelectedSchedule(null);
    } catch (error: any) {
      console.error("Error revoking schedule:", error);
      toast.error(`Failed to revoke schedule: ${error.message}`);
    } finally {
      setIsRevoking(false);
    }
  };

  if (vestingAuthorityQuery.isLoading) {
    return (
      <div className="flex justify-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center">
          <h2 className="card-title text-xl mb-0">
            {vestingAuthority?.vestingId}
          </h2>
          <span className="badge badge-primary badge-lg">Authority</span>
        </div>

        {!isLoadingBalance && (
          <div
            className={`alert ${
              isSufficientlyFunded ? "alert-success" : "alert-warning"
            } mt-4`}
          >
            {isSufficientlyFunded ? (
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  Treasury is sufficiently funded for all vesting schedules.
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <span>
                    Treasury needs additional funding of{" "}
                    <strong>{tokensNeeded.toLocaleString()}</strong> tokens.
                  </span>
                  <p className="text-xs mt-1">
                    Beneficiaries cannot claim tokens without sufficient
                    treasury funds.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="stats shadow mt-4 bg-base-200">
          <div className="stat">
            <div className="stat-title">Treasury Balance</div>
            <div className="stat-value text-primary">
              {isLoadingBalance ? (
                <span className="loading loading-spinner loading-md"></span>
              ) : (
                treasuryBalance?.toLocaleString() || "0"
              )}
            </div>
          </div>

          <div className="stat">
            <div className="stat-title">Total Allocated</div>
            <div className="stat-value">{totalAllocated.toLocaleString()}</div>
          </div>

          <div className="stat">
            <div className="stat-title">Total Claimed</div>
            <div className="stat-value text-accent">
              {totalWithdrawn.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Fund Treasury Section */}
        <div className="bg-base-200 p-4 rounded-lg mt-4">
          <h3 className="text-lg font-bold">Fund Treasury</h3>
          <p className="mt-2 text-sm opacity-70">
            Send tokens to enable beneficiaries to claim their vested tokens.
          </p>

          <div className="flex items-end gap-4 mt-4">
            <div className="form-control flex-1">
              <label className="label">
                <span className="label-text">Funding Amount</span>
              </label>
              <input
                type="number"
                value={fundingAmount || ""}
                onChange={(e) => setFundingAmount(Number(e.target.value) || 0)}
                placeholder="Enter amount to fund"
                className="input input-bordered w-full"
                min="1"
              />
            </div>

            <FundTreasuryButton
              treasuryAccount={
                vestingAuthority?.treasuryAccount?.toString() || ""
              }
              tokenMint={vestingAuthority?.tokenMint?.toString() || ""}
              amount={fundingAmount || 0}
            />
          </div>

          <div className="mt-4">
            <p className="text-sm opacity-70">Treasury Address:</p>
            <div className="bg-base-300 p-2 rounded flex items-center justify-between mt-1">
              <code className="text-xs break-all">
                {vestingAuthority?.treasuryAccount?.toString()}
              </code>
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(
                    vestingAuthority?.treasuryAccount?.toString() || ""
                  );
                  toast.success("Treasury address copied to clipboard!");
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
          <div className="flex justify-center p-4">
            <span className="loading loading-spinner loading-md"></span>
          </div>
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
                  <th>Details</th>
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

                  // Calculate remaining tokens
                  const vestedAmount = vestingAccount.revokedAt
                    ? Math.min(
                        Math.floor(
                          (Number(vestingAccount.totalAmount) *
                            Math.min(
                              Number(vestingAccount.revokedAt) -
                                Number(vestingAccount.startTime),
                              totalTime
                            )) /
                            totalTime
                        ),
                        Number(vestingAccount.totalAmount)
                      )
                    : now >= Number(vestingAccount.endTime)
                    ? Number(vestingAccount.totalAmount)
                    : Math.floor(
                        (Number(vestingAccount.totalAmount) * elapsedTime) /
                          totalTime
                      );

                  const remainingUnlockable =
                    Number(vestingAccount.totalAmount) - vestedAmount;

                  let status = "Upcoming";
                  if (vestingAccount.revokedAt) {
                    status = "Revoked";
                  } else if (now >= Number(vestingAccount.endTime)) {
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
                            className={`progress ${
                              vestingAccount.revokedAt
                                ? "progress-error"
                                : "progress-primary"
                            } w-20`}
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
                              : status === "Revoked"
                              ? "badge-error"
                              : "badge-ghost"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <div className="dropdown dropdown-end">
                            <label
                              tabIndex={0}
                              className="btn btn-xs btn-outline"
                            >
                              Actions
                            </label>
                            <ul
                              tabIndex={0}
                              className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                            >
                              <li>
                                <button
                                  className="text-xs"
                                  onClick={() => {
                                    // Open a modal with details
                                    const modal = document.getElementById(
                                      `details-${vestingAccount.publicKey.toString()}`
                                    ) as HTMLDialogElement | null;
                                    if (modal) {
                                      modal.showModal();
                                    }
                                  }}
                                >
                                  View Details
                                </button>
                              </li>
                              {!vestingAccount.revokedAt && (
                                <li>
                                  <button
                                    className="text-xs text-error"
                                    onClick={() => {
                                      setSelectedSchedule(
                                        vestingAccount.publicKey.toString()
                                      );
                                      setIsRevoking(true);
                                    }}
                                  >
                                    Revoke Schedule
                                  </button>
                                </li>
                              )}
                            </ul>
                          </div>

                          {/* Schedule Details Modal */}
                          <dialog
                            id={`details-${vestingAccount.publicKey.toString()}`}
                            className="modal"
                          >
                            <div className="modal-box">
                              <form method="dialog">
                                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                                  ✕
                                </button>
                              </form>
                              <h3 className="font-bold text-lg mb-4">
                                Vesting Schedule Details
                              </h3>

                              <div className="stats shadow mb-4 w-full">
                                <div className="stat">
                                  <div className="stat-title">
                                    Total Allocation
                                  </div>
                                  <div className="stat-value">
                                    {Number(
                                      vestingAccount.totalAmount
                                    ).toLocaleString()}
                                  </div>
                                </div>

                                <div className="stat">
                                  <div className="stat-title">Vested</div>
                                  <div className="stat-value">
                                    {vestedAmount.toLocaleString()}
                                  </div>
                                  <div className="stat-desc">
                                    {Math.floor(vestedPercentage)}%
                                  </div>
                                </div>

                                <div className="stat">
                                  <div className="stat-title">Withdrawn</div>
                                  <div className="stat-value">
                                    {Number(
                                      vestingAccount.totalWithdrawn
                                    ).toLocaleString()}
                                  </div>
                                  <div className="stat-desc">
                                    {Math.floor(withdrawnPercentage)}%
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm opacity-70">
                                    Beneficiary
                                  </p>
                                  <p className="font-mono text-xs break-all">
                                    {vestingAccount.beneficiary.toString()}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-sm opacity-70">Status</p>
                                  <span
                                    className={`badge ${
                                      status === "Active"
                                        ? "badge-primary"
                                        : status === "Completed"
                                        ? "badge-success"
                                        : status === "Revoked"
                                        ? "badge-error"
                                        : "badge-ghost"
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </div>

                                <div>
                                  <p className="text-sm opacity-70">
                                    Start Date
                                  </p>
                                  <p>
                                    {new Date(
                                      Number(vestingAccount.startTime) * 1000
                                    ).toLocaleString()}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-sm opacity-70">End Date</p>
                                  <p>
                                    {new Date(
                                      Number(vestingAccount.endTime) * 1000
                                    ).toLocaleString()}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-sm opacity-70">
                                    Cliff Date
                                  </p>
                                  <p>
                                    {new Date(
                                      Number(vestingAccount.cliffTime) * 1000
                                    ).toLocaleString()}
                                  </p>
                                </div>

                                {vestingAccount.revokedAt && (
                                  <div>
                                    <p className="text-sm opacity-70">
                                      Revoked At
                                    </p>
                                    <p>
                                      {new Date(
                                        Number(vestingAccount.revokedAt) * 1000
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="mt-4">
                                <p className="text-sm font-semibold mb-2">
                                  Vesting Progress
                                </p>
                                <div className="w-full bg-base-200 rounded-full h-4">
                                  <div
                                    className={`rounded-full h-4 ${
                                      vestingAccount.revokedAt
                                        ? "bg-error"
                                        : "bg-primary"
                                    }`}
                                    style={{ width: `${vestedPercentage}%` }}
                                  ></div>
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                  <span>Start</span>
                                  <span>
                                    {vestingAccount.revokedAt
                                      ? "Revoked"
                                      : "End"}
                                  </span>
                                </div>
                              </div>

                              {vestingAccount.revokedAt && (
                                <div className="alert alert-error mt-4">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="stroke-current shrink-0 h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <div>
                                    <span className="font-bold">
                                      Schedule Revoked
                                    </span>
                                    <p className="text-sm">
                                      This schedule was revoked on{" "}
                                      {new Date(
                                        Number(vestingAccount.revokedAt) * 1000
                                      ).toLocaleString()}
                                      .
                                      {remainingUnlockable > 0 &&
                                        ` ${remainingUnlockable.toLocaleString()} tokens will never vest.`}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </dialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="alert alert-info">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span>No beneficiaries added to this vesting account yet.</span>
          </div>
        )}

        {/* Revocation section */}
        {vestingSchedules.length > 0 && (
          <div className="mt-6 p-4 border border-base-300 rounded-lg">
            <h3 className="text-lg font-bold">Revoke Vesting Schedule</h3>
            <p className="mt-2 text-sm opacity-70">
              Revoking a schedule will stop further vesting. The beneficiary
              will only be able to claim tokens that were vested up to the
              revocation time.
            </p>

            <div className="flex items-end gap-4 mt-4">
              <div className="form-control flex-1">
                <label className="label">
                  <span className="label-text">Select Schedule to Revoke</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={selectedSchedule || ""}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                >
                  <option value="" disabled>
                    Select a beneficiary
                  </option>
                  {vestingSchedules
                    .filter((schedule) => !schedule.revokedAt)
                    .map((schedule) => (
                      <option
                        key={schedule.publicKey.toString()}
                        value={schedule.publicKey.toString()}
                      >
                        {ellipsify(schedule.beneficiary.toString())} -{" "}
                        {schedule.totalAmount.toString()} tokens
                      </option>
                    ))}
                </select>
              </div>

              <button
                className="btn btn-error"
                onClick={handleRevokeSchedule}
                disabled={isRevoking || !selectedSchedule}
              >
                {isRevoking ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Revoking...
                  </>
                ) : (
                  "Revoke Schedule"
                )}
              </button>
            </div>
          </div>
        )}
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
                {new Date(
                  Number(vestingSchedule.cliffTime) * 1000
                ).toLocaleString()}
              </span>
              <p className="text-xs mt-1">
                Current time: {new Date(Number(now) * 1000).toLocaleString()}
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

function FundTreasuryButton({
  treasuryAccount,
  tokenMint,
  amount,
}: {
  treasuryAccount: string;
  tokenMint: string;
  amount: number;
}) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isFunding, setIsFunding] = useState(false);

  const handleFundTreasury = async () => {
    if (!wallet.publicKey || !treasuryAccount || !tokenMint || !amount) return;

    setIsFunding(true);
    try {
      // Create a transfer instruction
      const fromTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(tokenMint),
        wallet.publicKey
      );

      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        new PublicKey(treasuryAccount),
        wallet.publicKey,
        amount
      );

      // Create and send transaction
      const transaction = new Transaction().add(transferInstruction);
      const signature = await wallet.sendTransaction(transaction, connection);
      const latestBlockhash = await connection.getLatestBlockhash();

      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        "confirmed"
      );

      toast.success(`Successfully funded treasury with ${amount} tokens!`);
    } catch (error: any) {
      console.error("Error funding treasury:", error);
      toast.error(`Failed to fund treasury: ${error.message}`);
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <button
      className="btn btn-primary"
      onClick={handleFundTreasury}
      disabled={isFunding || !wallet.connected}
    >
      {isFunding ? (
        <>
          <span className="loading loading-spinner loading-sm"></span>
          Funding...
        </>
      ) : (
        "Fund Treasury"
      )}
    </button>
  );
}
