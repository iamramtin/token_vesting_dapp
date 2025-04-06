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

export interface CreateVestingAuthorityArgs {
  vestingId: string;
  tokenMint: string;
}

export interface CreateVestingScheduleArgs {
  beneficiary: string;
  vestingAuthority: string;
  startTime: number;
  endTime: number;
  cliffTime: number;
  totalAmount: number;
}

export interface ClaimArgs {
  vestingId: string;
}

export const findVestingAuthorityPda = (
  vestingId: string,
  programId: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_authority"), Buffer.from(vestingId)],
    programId
  );
};

export const findTreasuryPda = (vestingId: string, programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_treasury"), Buffer.from(vestingId)],
    programId
  );
};

export const findVestingSchedulePda = (
  beneficiary: PublicKey,
  vestingAuthority: PublicKey,
  programId: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("vesting_schedule"),
      beneficiary.toBuffer(),
      vestingAuthority.toBuffer(),
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
    queryFn: () => program.account.vestingAuthority.all(),
  });

  // Query to fetch all authority vesting accounts for the connected wallet
  const getVestingAuthorityAccounts = useQuery({
    queryKey: [
      "vestingAuthority",
      "all",
      { cluster, publicKey: publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!publicKey) return [];

      try {
        // Fetch all accounts of type VestingAuthority where authority = publicKey
        const accounts = await program.account.vestingAuthority.all([
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
        console.error("Error fetching vesting authority accounts:", error);
        return [];
      }
    },
    enabled: !!publicKey && !!provider,
  });

  // Query to fetch all beneficiary vesting accounts for the connected wallet (as a beneficiary)
  const getVestingScheduleAccounts = useQuery({
    queryKey: [
      "vestingSchedule",
      "all",
      { cluster, publicKey: publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!publicKey) return [];

      try {
        // Fetch all accounts of type VestingSchedule where beneficiary = publicKey
        const accounts = await program.account.vestingSchedule.all([
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
        console.error("Error fetching beneficiary vesting accounts:", error);
        return [];
      }
    },
    enabled: !!publicKey && !!provider,
  });

  const createVestingAuthorityAccount = useMutation<
    string,
    Error,
    CreateVestingAuthorityArgs
  >({
    mutationKey: ["vesting-authority", "create", { cluster }],
    mutationFn: async ({ vestingId, tokenMint }) => {
      try {
        return program.methods
          .createVestingAuthority(vestingId)
          .accounts({
            tokenMint: new PublicKey(tokenMint),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
      } catch (error) {
        console.error("Error creating authority vesting account:", error);
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Vesting authority account created successfully!");
      return queryClient.invalidateQueries({ queryKey: ["vesting-authority"] });
    },
    onError: (error) =>
      toast.error(`Failed to create vesting authority account: ${error}`),
  });

  const createVestingScheduleAccount = useMutation<
    string,
    Error,
    CreateVestingScheduleArgs
  >({
    mutationKey: ["vesting-schedule", "create", { cluster }],
    mutationFn: async ({
      beneficiary,
      vestingAuthority,
      startTime,
      endTime,
      cliffTime,
      totalAmount,
    }) => {
      try {
        return program.methods
          .createVestingSchedule(
            new BN(startTime),
            new BN(endTime),
            new BN(cliffTime),
            new BN(totalAmount)
          )
          .accounts({
            beneficiary,
            vestingAuthority,
          })
          .rpc();
      } catch (error) {
        console.error("Error creating vesting schedule account:", error);
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Vesting schedule account created successfully!");
      return queryClient.invalidateQueries({ queryKey: ["vesting-authority"] });
    },
    onError: (error) =>
      toast.error(`Failed to create vesting schedule account: ${error}`),
  });

  const claimTokens = useMutation<string, Error, ClaimArgs>({
    mutationKey: ["vesting-schedule", "claim", { cluster }],
    mutationFn: async ({ vestingId }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        return program.methods
          .claim(vestingId)
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
      return queryClient.invalidateQueries({ queryKey: ["vesting-schedule"] });
    },
    onError: (error) => toast.error(`Failed to claim tokens: ${error.message}`),
  });

  return {
    program,
    programId,
    getProgramAccount,
    accounts,
    getVestingAuthorityAccounts,
    getVestingScheduleAccounts,
    createVestingAuthorityAccount,
    createVestingScheduleAccount,
    claimTokens,
  };
}

export function useVestingAuthorityAccount(
  vestingAuthorityKey: PublicKey | undefined
) {
  const { cluster } = useCluster();
  const { program } = useVestingProgram();
  const provider = useAnchorProvider();

  const accountQuery = useQuery({
    queryKey: ["vesting", "fetch", { cluster, vestingAuthorityKey }],
    queryFn: () => {
      if (!vestingAuthorityKey) {
        throw new Error("vestingAuthorityKey is undefined");
      }
      return program.account.vestingAuthority.fetch(vestingAuthorityKey);
    },
  });

  // Query to fetch the authority vesting account details
  const vestingAuthorityQuery = useQuery({
    queryKey: [
      "vestingAuthority",
      "fetch",
      { cluster, vestingAuthorityKey: vestingAuthorityKey?.toString() },
    ],
    queryFn: async () => {
      if (!vestingAuthorityKey) return null;

      try {
        const account = await program.account.vestingAuthority.fetch(
          vestingAuthorityKey
        );
        return account;
      } catch (error) {
        console.error("Error fetching authority vesting:", error);
        return null;
      }
    },
    enabled: !!vestingAuthorityKey && !!provider,
  });

  // Query to fetch all beneficiary vesting accounts for this authority
  const vestingSchedulesQuery = useQuery({
    queryKey: [
      "beneficiary-vestings",
      { cluster, vestingAuthorityKey: vestingAuthorityKey?.toString() },
    ],
    queryFn: async () => {
      if (!vestingAuthorityKey) return [];

      try {
        const accounts = await program.account.vestingSchedule.all([
          {
            memcmp: {
              offset: ANCHOR_DISCRIMINATOR_SIZE + 32,
              bytes: vestingAuthorityKey.toBase58(),
            },
          },
        ]);

        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error) {
        console.error("Error fetching beneficiary vestings:", error);
        return [];
      }
    },
    enabled:
      !!vestingAuthorityKey && !!provider && !!vestingAuthorityQuery.data,
  });

  return {
    accountQuery,
    vestingAuthorityQuery,
    vestingSchedulesQuery,
  };
}

export function useVestingScheduleAccount(
  vestingBeneficiaryKey: PublicKey | undefined
) {
  const { cluster } = useCluster();
  const { program } = useVestingProgram();
  const provider = useAnchorProvider();

  // Query to fetch the beneficiary vesting account details
  const vestingScheduleQuery = useQuery({
    queryKey: [
      "vestingSchedule",
      "fetch",
      { cluster, vestingBeneficiaryKey: vestingBeneficiaryKey?.toString() },
    ],
    queryFn: async () => {
      if (!vestingBeneficiaryKey) return null;

      try {
        const account = await program.account.vestingSchedule.fetch(
          vestingBeneficiaryKey
        );
        return account;
      } catch (error) {
        console.error("Error fetching beneficiary vesting:", error);
        return null;
      }
    },
    enabled: !!vestingBeneficiaryKey && !!provider,
  });

  return {
    vestingScheduleQuery,
  };
}
