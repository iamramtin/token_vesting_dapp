"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cluster, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProvider } from "../solana/solana-provider";
import { useCluster } from "../cluster/cluster-data-access";
import toast from "react-hot-toast";
import { useMemo } from "react";
import { useTransactionToast } from "../ui/ui-layout";

import {
  ANCHOR_DISCRIMINATOR_SIZE,
  getVestingProgram,
  getVestingProgramId,
} from "../../../anchor/src/vesting-exports";

export interface CreateEmployerVestingAccountArgs {
  companyName: string;
  tokenMint: string;
}

export interface CreateEmployeeVestingAccountArgs {
  employee: string;
  employerVesting: string;
  startTime: number;
  endTime: number;
  cliffTime: number;
  totalAmount: number;
}

export interface ClaimTokensArgs {
  companyName: string;
}

export const findEmployerVestingPDA = (
  companyName: string,
  programId: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("employer_vesting"), Buffer.from(companyName)],
    programId
  );
};

export const findTreasuryPDA = (companyName: string, programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
    programId
  );
};

export const findEmployeeVestingPDA = (
  employee: PublicKey,
  employerVesting: PublicKey,
  programId: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("employee_vesting"),
      employee.toBuffer(),
      employerVesting.toBuffer(),
    ],
    programId
  );
};

export function useVestingProgram() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { cluster } = useCluster();
  const provider = useAnchorProvider();
  const queryClient = useQueryClient();

  const transactionToast = useTransactionToast();

  const programId = useMemo(
    () => getVestingProgramId(cluster.network as Cluster),
    [cluster]
  );

  const program = useMemo(
    () => getVestingProgram(provider, programId),
    [provider, programId]
  );

  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  const accounts = useQuery({
    queryKey: ["vesting", "all", { cluster }],
    queryFn: () => program.account.employerVesting.all(),
  });

  // Query to fetch all employer vesting accounts for the connected wallet
  const getEmployerVestingAccounts = useQuery({
    queryKey: [
      "employerVesting",
      "all",
      { cluster, publicKey: publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!publicKey) return [];

      try {
        // Fetch all accounts of type EmployerVesting where employer = publicKey
        const accounts = await program.account.employerVesting.all([
          {
            memcmp: {
              offset: ANCHOR_DISCRIMINATOR_SIZE,
              bytes: publicKey.toBase58(),
            },
          },
        ]);

        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error) {
        console.error("Error fetching employer vesting accounts:", error);
        return [];
      }
    },
    enabled: !!publicKey && !!provider,
  });

  // Query to fetch all employee vesting accounts for the connected wallet (as an employee)
  const getEmployeeVestingAccounts = useQuery({
    queryKey: [
      "employeeVesting",
      "all",
      { cluster, publicKey: publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!publicKey) return [];

      try {
        // Fetch all accounts of type EmployeeVesting where employee = publicKey
        const accounts = await program.account.employeeVesting.all([
          {
            memcmp: {
              offset: ANCHOR_DISCRIMINATOR_SIZE,
              bytes: publicKey.toBase58(),
            },
          },
        ]);

        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error) {
        console.error("Error fetching employee vesting accounts:", error);
        return [];
      }
    },
    enabled: !!publicKey && !!provider,
  });

  const createEmployerVestingAccount = useMutation<
    string,
    Error,
    CreateEmployerVestingAccountArgs
  >({
    mutationKey: ["employer-vesting", "create", { cluster }],
    mutationFn: async ({ companyName, tokenMint }) => {
      try {
        return program.methods
          .createEmployerVesting(companyName)
          .accounts({
            tokenMint: new PublicKey(tokenMint),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      } catch (error) {
        console.error("Error creating employer vesting account:", error);
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Employer vesting account created successfully!");
      return queryClient.invalidateQueries({ queryKey: ["employer-vesting"] });
    },
    onError: (error) =>
      toast.error(`Failed to create employer vesting account: ${error}`),
  });

  const createEmployeeVestingAccount = useMutation<
    string,
    Error,
    CreateEmployeeVestingAccountArgs
  >({
    mutationKey: ["employee-vesting", "create", { cluster }],
    mutationFn: async ({
      employee,
      employerVesting,
      startTime,
      endTime,
      cliffTime,
      totalAmount,
    }) => {
      try {
        return program.methods
          .createEmployeeVesting(
            new BN(startTime),
            new BN(endTime),
            new BN(cliffTime),
            new BN(totalAmount)
          )
          .accounts({
            employee,
            employerVesting,
          })
          .rpc();
      } catch (error) {
        console.error("Error creating employee vesting account:", error);
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Employee vesting account created successfully!");
      return queryClient.invalidateQueries({ queryKey: ["employer-vesting"] });
    },
    onError: (error) =>
      toast.error(`Failed to create employee vesting account: ${error}`),
  });

  const claimTokens = useMutation<string, Error, ClaimTokensArgs>({
    mutationKey: ["employee-vesting", "create", { cluster }],
    mutationFn: async ({ companyName }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        return program.methods
          .claimTokens(companyName)
          .accounts({
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      } catch (error) {
        console.error("Error claiming tokens:", error);
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Tokens claimed successfully!");
      return queryClient.invalidateQueries({ queryKey: ["employee-vesting"] });
    },
    onError: (error) => toast.error(`Failed to claim tokens: ${error}`),
  });

  return {
    program,
    programId,
    getProgramAccount,
    accounts,
    getEmployerVestingAccounts,
    getEmployeeVestingAccounts,
    createEmployerVestingAccount,
    createEmployeeVestingAccount,
    claimTokens,
  };
}

export function useEmployerVestingAccount(
  employerVestingKey: PublicKey | undefined
) {
  const { cluster } = useCluster();
  const { program } = useVestingProgram();
  const provider = useAnchorProvider();

  const accountQuery = useQuery({
    queryKey: ["vesting", "fetch", { cluster, employerVestingKey }],
    queryFn: () => {
      if (!employerVestingKey) {
        throw new Error("employerVestingKey is undefined");
      }
      return program.account.employerVesting.fetch(employerVestingKey);
    },
  });

  // Query to fetch the employer vesting account details
  const employerVestingQuery = useQuery({
    queryKey: [
      "employerVesting",
      "fetch",
      { cluster, employerVestingKey: employerVestingKey?.toString() },
    ],
    queryFn: async () => {
      if (!employerVestingKey) return null;

      try {
        const account = await program.account.employerVesting.fetch(
          employerVestingKey
        );
        return account;
      } catch (error) {
        console.error("Error fetching employer vesting:", error);
        return null;
      }
    },
    enabled: !!employerVestingKey && !!provider,
  });

  // Query to fetch all employee vesting accounts for this employer
  const employeeVestingsQuery = useQuery({
    queryKey: [
      "employee-vestings",
      { cluster, employerVestingKey: employerVestingKey?.toString() },
    ],
    queryFn: async () => {
      if (!employerVestingKey) return [];

      try {
        const accounts = await program.account.employeeVesting.all([
          {
            memcmp: {
              offset: ANCHOR_DISCRIMINATOR_SIZE + 32,
              bytes: employerVestingKey.toBase58(),
            },
          },
        ]);

        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error) {
        console.error("Error fetching employee vestings:", error);
        return [];
      }
    },
    enabled: !!employerVestingKey && !!provider && !!employerVestingQuery.data,
  });

  return {
    accountQuery,
    employerVestingQuery,
    employeeVestingsQuery,
  };
}

export function useEmployeeVestingAccount(
  employeeVestingKey: PublicKey | undefined
) {
  const { cluster } = useCluster();
  const { program } = useVestingProgram();
  const provider = useAnchorProvider();

  // Query to fetch the employee vesting account details
  const employeeVestingQuery = useQuery({
    queryKey: [
      "employeeVesting",
      "fetch",
      { cluster, employeeVestingKey: employeeVestingKey?.toString() },
    ],
    queryFn: async () => {
      if (!employeeVestingKey) return null;

      try {
        const account = await program.account.employeeVesting.fetch(
          employeeVestingKey
        );
        return account;
      } catch (error) {
        console.error("Error fetching employee vesting:", error);
        return null;
      }
    },
    enabled: !!employeeVestingKey && !!provider,
  });

  return {
    employeeVestingQuery,
  };
}
